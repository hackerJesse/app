import os
import json
import uuid
import socket
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Annotated

import httpx
import requests
import bcrypt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, Header, HTTPException, UploadFile, File, Request, Response
import stripe
from fastapi.responses import FileResponse
from fastapi.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("infra")

app = FastAPI()
api_router = APIRouter(prefix="/api")

ADMIN_EMAIL = "jesse.araujo@nsecurity.com.br"
ADMIN_PASSWORD = "3645QPwo$"

# --------------------------------------------------------------------------- #
# Object storage
# --------------------------------------------------------------------------- #
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "nsecurity-inframanager"
_storage_key: Optional[str] = None


def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _to_str_id(v: Any) -> str:
    return str(v)


PyObjectId = Annotated[str, BeforeValidator(_to_str_id)]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def strip_id(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
class LoginInput(BaseModel):
    email: str
    password: str


class SessionInput(BaseModel):
    session_id: str


class ClientModel(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    name: str
    company: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    document: Optional[str] = ""
    address: Optional[str] = ""
    state: Optional[str] = ""
    city: Optional[str] = ""
    contract_path: Optional[str] = ""
    notes: Optional[str] = ""


class QuoteItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0
    detail: Optional[str] = ""


class QuoteModel(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    number: Optional[str] = ""
    client_id: Optional[str] = ""
    client_name: Optional[str] = ""
    kind: str = "venda"
    status: str = "rascunho"
    items: List[QuoteItem] = Field(default_factory=list)
    discount: float = 0
    tax: float = 0
    notes: Optional[str] = ""
    valid_until: Optional[str] = ""


class RackSlot(BaseModel):
    server_id: Optional[str] = ""
    u_start: int
    u_size: int = 1
    kind: str = "generic"
    label: str = ""
    detail: Optional[str] = ""


class RackModel(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    name: str
    client_id: Optional[str] = ""
    client_name: Optional[str] = ""
    size_u: int = 48
    location: Optional[str] = ""
    slots: List[RackSlot] = Field(default_factory=list)


class TopoNode(BaseModel):
    id: str
    kind: str = "pc"
    label: str = ""
    x: float = 0
    y: float = 0
    ip: Optional[str] = ""
    ports: Optional[str] = ""
    room: Optional[str] = ""


class TopoLink(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = ""


class TopologyModel(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    name: str
    client_id: Optional[str] = ""
    client_name: Optional[str] = ""
    nodes: List[TopoNode] = Field(default_factory=list)
    links: List[TopoLink] = Field(default_factory=list)


class FloorPoint(BaseModel):
    id: str
    x: float
    y: float
    label: str = ""
    kind: str = "network"
    room: Optional[str] = ""
    detail: Optional[str] = ""


class FloorRoom(BaseModel):
    id: str
    x: float
    y: float
    w: float = 20
    h: float = 15
    label: str = ""


class FloorPlanModel(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    name: str
    client_id: Optional[str] = ""
    client_name: Optional[str] = ""
    mode: str = "upload"
    image_path: Optional[str] = ""
    points: List[FloorPoint] = Field(default_factory=list)
    rooms: List[FloorRoom] = Field(default_factory=list)


class ServerModel(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    name: str
    client_id: Optional[str] = ""
    client_name: Optional[str] = ""
    host: str = ""
    port: int = 443
    state: Optional[str] = ""
    city: Optional[str] = ""
    map_x: float = 50
    map_y: float = 50
    os: Optional[str] = ""
    cpu: Optional[str] = ""
    ram: Optional[str] = ""
    disk: Optional[str] = ""
    role: Optional[str] = ""
    notes: Optional[str] = ""
    topology_id: Optional[str] = ""
    status: str = "unknown"
    latency_ms: Optional[float] = None
    last_check: Optional[str] = ""
    agent_key: Optional[str] = ""
    metrics: Optional[dict] = None
    metrics_history: List[dict] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def has_access(u: dict) -> bool:
    if u.get("role") in ("admin", "operator"):
        return True
    if u.get("blocked"):
        return False
    if not u.get("has_access"):
        return False
    if u.get("plan") == "monthly":
        paid = u.get("paid_at")
        if paid:
            try:
                dt = datetime.fromisoformat(paid)
                window = int(u.get("grant_days") or 0) + 3 if u.get("granted_by_admin") else 33
                if datetime.now(timezone.utc) - dt > timedelta(days=window) and u.get("subscription_status") != "active_webhook":
                    return False
            except ValueError:
                pass
    return True


def public_user(u: dict) -> dict:
    return {
        "user_id": u.get("user_id"),
        "email": u.get("email"),
        "name": u.get("name", ""),
        "picture": u.get("picture", ""),
        "role": u.get("role", "user"),
        "cpf": u.get("cpf", ""),
        "phone": u.get("phone", ""),
        "address": u.get("address", ""),
        "has_access": has_access(u),
        "plan": u.get("plan", ""),
        "subscription_status": u.get("subscription_status", ""),
        "contract_accepted_at": u.get("contract_accepted_at", ""),
        "language": u.get("language", "pt"),
    }


ACCESS_FREE_PREFIXES = ("/api/auth", "/api/account", "/api/billing", "/api/agent", "/api/webhook")


async def create_session(user_id: str) -> str:
    owner = await db.users.find_one({"user_id": user_id}, {"_id": 0, "role": 1})
    if not owner or owner.get("role") != "admin":
        await db.user_sessions.delete_many({"user_id": user_id})  # um dispositivo por usuário
    token = uuid.uuid4().hex + uuid.uuid4().hex
    await db.user_sessions.insert_one(
        {
            "session_token": token,
            "user_id": user_id,
            "created_at": now_iso(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        }
    )
    return token


async def get_current_user(request: Request = None, authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = sess.get("expires_at")
    if exp:
        try:
            exp_dt = datetime.fromisoformat(exp)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if exp_dt < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="Session expired")
        except ValueError:
            pass
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("role") == "operator":
        parent = await db.users.find_one({"user_id": user.get("parent_id")}, {"_id": 0})
        if not parent or user.get("blocked"):
            raise HTTPException(status_code=403, detail="Operador desativado")
        if request is not None and request.method == "DELETE":
            raise HTTPException(status_code=403, detail="Operador não pode excluir registros")
        # opera sobre os dados do titular da licença
        user = {**parent, "user_id": parent["user_id"], "role": "operator", "email": user["email"], "name": user.get("name", ""), "operator_id": user["user_id"], "language": user.get("language", parent.get("language", "pt"))}
    path = request.url.path if request is not None else ""
    if path and not path.startswith(ACCESS_FREE_PREFIXES):
        if not has_access(user):
            raise HTTPException(status_code=402, detail="Assinatura necessária")
        if not user.get("contract_accepted_at") and user.get("role") not in ("admin", "operator"):
            raise HTTPException(status_code=402, detail="Contrato não aceito")
    return user


@api_router.post("/auth/login")
async def login(body: LoginInput):
    user = await db.users.find_one({"email": body.email.lower().strip()})
    if not user or not user.get("password_hash") or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    token = await create_session(user["user_id"])
    return {"session_token": token, "user": public_user(user)}


@api_router.post("/auth/session")
async def auth_session(body: SessionInput):
    async with httpx.AsyncClient(timeout=30) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session id")
    data = r.json()
    email = (data.get("email") or "").lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", existing.get("name", "")), "picture": data.get("picture", "")}},
        )
        user = await db.users.find_one({"user_id": user_id})
    else:
        user_id = "user_" + uuid.uuid4().hex[:12]
        role = "admin" if email == ADMIN_EMAIL else "user"
        user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "role": role,
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    token = await create_session(user_id)
    return {"session_token": token, "user": public_user(user)}


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---- Registration / account / billing ----
class RegisterInput(BaseModel):
    full_name: str
    email: str
    password: str
    cpf: str
    phone: Optional[str] = ""
    address: str


class OperatorInput(BaseModel):
    name: str
    email: str
    password: str


@api_router.get("/account/operator")
async def get_operator(user: dict = Depends(get_current_user)):
    op = await db.users.find_one({"parent_id": user["user_id"], "role": "operator"}, {"_id": 0, "password_hash": 0})
    return op or None


@api_router.post("/account/operator")
async def create_operator(body: OperatorInput, user: dict = Depends(get_current_user)):
    if user.get("role") == "operator":
        raise HTTPException(status_code=403, detail="Operador não pode criar usuários")
    if not has_access(user) or (user.get("role") != "admin" and not user.get("contract_accepted_at")):
        raise HTTPException(status_code=402, detail="Licença ativa necessária")
    if await db.users.find_one({"parent_id": user["user_id"], "role": "operator"}):
        raise HTTPException(status_code=409, detail="A licença permite apenas 1 usuário operador")
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Senha muito curta")
    op = {"user_id": "user_" + uuid.uuid4().hex[:12], "email": email, "name": body.name.strip(), "picture": "", "role": "operator", "parent_id": user["user_id"], "password_hash": hash_pw(body.password), "has_access": True, "created_at": now_iso()}
    await db.users.insert_one(dict(op))
    op.pop("password_hash")
    return op


@api_router.delete("/account/operator")
async def remove_operator(user: dict = Depends(get_current_user)):
    op = await db.users.find_one({"parent_id": user["user_id"], "role": "operator"})
    if op:
        await db.user_sessions.delete_many({"user_id": op["user_id"]})
        await db.users.delete_one({"user_id": op["user_id"]})
    return {"ok": True}


class ContractInput(BaseModel):
    accept: bool
    full_name: str
    cpf: str


class CheckoutInput(BaseModel):
    plan: str
    origin: str


PLANS = {
    "monthly": {"name": "InfraManager — Assinatura mensal (por usuário)", "amount": 2590, "mode": "subscription"},
    "lifetime": {"name": "InfraManager — Licença vitalícia ilimitada (de R$ 1.500 por R$ 999)", "amount": 99900, "mode": "payment"},
}
STRIPE_KEY = os.environ.get("STRIPE_API_KEY", "")


def stripe_client():
    stripe.api_key = STRIPE_KEY
    if "sk_test_emergent" in STRIPE_KEY:
        stripe.api_base = "https://integrations.emergentagent.com/stripe"
    return stripe


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "")) or ""


@api_router.post("/auth/register")
async def register(body: RegisterInput):
    email = body.email.lower().strip()
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="A senha deve ter ao menos 6 caracteres")
    cpf_digits = "".join(ch for ch in body.cpf if ch.isdigit())
    if len(cpf_digits) != 11:
        raise HTTPException(status_code=400, detail="CPF inválido")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")
    user = {
        "user_id": "user_" + uuid.uuid4().hex[:12],
        "email": email,
        "name": body.full_name.strip(),
        "picture": "",
        "role": "admin" if email == ADMIN_EMAIL else "user",
        "password_hash": hash_pw(body.password),
        "cpf": cpf_digits,
        "phone": body.phone,
        "address": body.address,
        "has_access": False,
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    token = await create_session(user["user_id"])
    return {"session_token": token, "user": public_user(user)}


class ProfileInput(BaseModel):
    language: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None


@api_router.put("/account/profile")
async def update_profile(body: ProfileInput, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if upd.get("language") not in (None, "pt", "en", "es"):
        raise HTTPException(status_code=400, detail="Idioma inválido")
    if upd:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    return public_user({**user, **upd})


@api_router.post("/account/contract")
async def accept_contract(body: ContractInput, request: Request, user: dict = Depends(get_current_user)):
    if not body.accept:
        raise HTTPException(status_code=400, detail="É necessário aceitar o contrato")
    cpf_digits = "".join(ch for ch in body.cpf if ch.isdigit())
    if len(cpf_digits) != 11:
        raise HTTPException(status_code=400, detail="CPF inválido")
    upd = {"contract_accepted_at": now_iso(), "contract_ip": client_ip(request), "name": body.full_name.strip(), "cpf": cpf_digits, "contract_version": "1.0"}
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    return public_user({**user, **upd})


@api_router.post("/billing/checkout")
async def billing_checkout(body: CheckoutInput, user: dict = Depends(get_current_user)):
    plan = PLANS.get(body.plan)
    if not plan:
        raise HTTPException(status_code=400, detail="Plano inválido")
    if not STRIPE_KEY:
        raise HTTPException(status_code=500, detail="Stripe não configurado")
    origin = body.origin.rstrip("/")
    price_data: dict = {"currency": "brl", "unit_amount": plan["amount"], "product_data": {"name": plan["name"]}}
    if plan["mode"] == "subscription":
        price_data["recurring"] = {"interval": "month"}
    sc = stripe_client()
    session = await run_in_threadpool(
        lambda: sc.checkout.Session.create(
            mode=plan["mode"],
            line_items=[{"price_data": price_data, "quantity": 1}],
            success_url=f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/billing/cancel",
            customer_email=user.get("email"),
            metadata={"user_id": user["user_id"], "plan": body.plan},
        )
    )
    await db.payment_transactions.insert_one(
        {"session_id": session.id, "user_id": user["user_id"], "plan": body.plan, "amount": plan["amount"], "currency": "brl", "status": "pending", "created_at": now_iso()}
    )
    return {"url": session.url, "session_id": session.id}


async def grant_access(user_id: str, plan: str, session_id: str):
    upd = {"has_access": True, "plan": plan, "last_checkout_session": session_id, "paid_at": now_iso()}
    if plan == "monthly":
        upd["subscription_status"] = "active"
    else:
        upd["license"] = "lifetime"
    await db.users.update_one({"user_id": user_id}, {"$set": upd})
    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {"status": "paid", "paid_at": now_iso()}})


@api_router.get("/billing/status/{session_id}")
async def billing_status(session_id: str, user: dict = Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    if tx["status"] != "paid":
        sc = stripe_client()
        s = await run_in_threadpool(lambda: sc.checkout.Session.retrieve(session_id))
        if s.payment_status == "paid":
            await grant_access(user["user_id"], tx["plan"], session_id)
            tx["status"] = "paid"
        else:
            tx["status"] = "expired" if s.status == "expired" else "pending"
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"status": tx["status"], "plan": tx["plan"], "user": public_user(fresh)}


@api_router.get("/billing/me")
async def billing_me(user: dict = Depends(get_current_user)):
    txs = await db.payment_transactions.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    pending = [t for t in txs if t["status"] == "pending"]
    # refresh the latest pending session, if any
    if pending and STRIPE_KEY:
        latest = sorted(pending, key=lambda t: t["created_at"])[-1]
        try:
            sc = stripe_client()
            s = await run_in_threadpool(lambda: sc.checkout.Session.retrieve(latest["session_id"]))
            if s.payment_status == "paid":
                await grant_access(user["user_id"], latest["plan"], latest["session_id"])
        except Exception as e:
            logger.warning(f"stripe refresh failed: {e}")
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    txs = await db.payment_transactions.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    return {"user": public_user(fresh), "plans": PLANS, "transactions": txs}


@api_router.get("/admin/subscribers")
async def admin_subscribers(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Somente administradores")
    users = await db.users.find({"role": {"$ne": "admin"}}, {"_id": 0, "password_hash": 0}).to_list(2000)
    txs = await db.payment_transactions.find({}, {"_id": 0}).to_list(5000)
    out = []
    for u in users:
        mine = [t for t in txs if t["user_id"] == u["user_id"]]
        out.append(
            {
                **public_user(u),
                "blocked": bool(u.get("blocked")),
                "paid_at": u.get("paid_at", ""),
                "created_at": u.get("created_at", ""),
                "contract_ip": u.get("contract_ip", ""),
                "total_paid": sum(t["amount"] for t in mine if t["status"] == "paid") / 100,
                "transactions": sorted(mine, key=lambda t: t["created_at"], reverse=True),
            }
        )
    return out


class AccessInput(BaseModel):
    blocked: bool


@api_router.post("/admin/subscribers/{user_id}/access")
async def admin_set_access(user_id: str, body: AccessInput, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Somente administradores")
    await db.users.update_one({"user_id": user_id}, {"$set": {"blocked": body.blocked}})
    if body.blocked:
        await db.user_sessions.delete_many({"user_id": user_id})
    return {"ok": True}


class GrantInput(BaseModel):
    plan: str = "monthly"
    days: int = 30


@api_router.post("/admin/subscribers/{user_id}/grant")
async def admin_grant(user_id: str, body: GrantInput, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Somente administradores")
    upd = {"has_access": True, "blocked": False, "plan": body.plan, "paid_at": now_iso(), "granted_by_admin": True, "grant_days": body.days}
    if body.plan == "lifetime":
        upd["license"] = "lifetime"
    await db.users.update_one({"user_id": user_id}, {"$set": upd})
    return {"ok": True}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not secret:
        return {"ok": True, "ignored": True}
    try:
        event = stripe.Webhook.construct_event(payload, request.headers.get("stripe-signature"), secret)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook")
    obj = event["data"]["object"]
    if event["type"] == "checkout.session.completed" and obj.get("payment_status") == "paid":
        meta = obj.get("metadata") or {}
        if meta.get("user_id"):
            await grant_access(meta["user_id"], meta.get("plan", "monthly"), obj["id"])
    elif event["type"] == "invoice.paid":
        email = (obj.get("customer_email") or "").lower()
        if email:
            await db.users.update_one({"email": email}, {"$set": {"paid_at": now_iso(), "has_access": True, "subscription_status": "active"}})
    elif event["type"] in ("customer.subscription.deleted", "invoice.payment_failed"):
        email = (obj.get("customer_email") or "").lower()
        if email:
            await db.users.update_one({"email": email, "plan": "monthly"}, {"$set": {"has_access": False, "subscription_status": "inactive"}})
    return {"ok": True}


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


async def owned_list(coll, user_id: str):
    return await coll.find({"owner_id": user_id, "deleted_at": {"$in": [None, ""]}}, {"_id": 0}).to_list(1000)


# ---- Clients ----
@api_router.get("/clients")
async def list_clients(user: dict = Depends(get_current_user)):
    return await owned_list(db.clients, user["user_id"])


@api_router.post("/clients")
async def create_client(body: ClientModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"owner_id": user["user_id"], "created_at": now_iso(), "deleted_at": None})
    await db.clients.insert_one(dict(doc))
    return strip_id(doc)


@api_router.put("/clients/{item_id}")
async def update_client(item_id: str, body: ClientModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = item_id
    await db.clients.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": doc})
    return await db.clients.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/clients/{item_id}")
async def delete_client(item_id: str, user: dict = Depends(get_current_user)):
    await db.clients.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


# ---- Quotes ----
@api_router.get("/quotes")
async def list_quotes(user: dict = Depends(get_current_user)):
    return await owned_list(db.quotes, user["user_id"])


@api_router.post("/quotes")
async def create_quote(body: QuoteModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    if not doc.get("number"):
        count = await db.quotes.count_documents({"owner_id": user["user_id"]})
        doc["number"] = f"ORC-{count + 1:04d}"
    doc.update({"owner_id": user["user_id"], "created_at": now_iso(), "deleted_at": None})
    await db.quotes.insert_one(dict(doc))
    return strip_id(doc)


@api_router.put("/quotes/{item_id}")
async def update_quote(item_id: str, body: QuoteModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = item_id
    await db.quotes.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": doc})
    return await db.quotes.find_one({"id": item_id}, {"_id": 0})


@api_router.patch("/quotes/{item_id}/status")
async def set_quote_status(item_id: str, body: dict, user: dict = Depends(get_current_user)):
    await db.quotes.update_one(
        {"id": item_id, "owner_id": user["user_id"]}, {"$set": {"status": body.get("status", "rascunho")}}
    )
    return await db.quotes.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/quotes/{item_id}")
async def delete_quote(item_id: str, user: dict = Depends(get_current_user)):
    await db.quotes.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


# ---- Racks ----
@api_router.get("/racks")
async def list_racks(user: dict = Depends(get_current_user)):
    return await owned_list(db.racks, user["user_id"])


@api_router.post("/racks")
async def create_rack(body: RackModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"owner_id": user["user_id"], "created_at": now_iso(), "deleted_at": None})
    await db.racks.insert_one(dict(doc))
    return strip_id(doc)


@api_router.put("/racks/{item_id}")
async def update_rack(item_id: str, body: RackModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = item_id
    await db.racks.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": doc})
    return await db.racks.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/racks/{item_id}")
async def delete_rack(item_id: str, user: dict = Depends(get_current_user)):
    await db.racks.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


# ---- Topologies ----
@api_router.get("/topologies")
async def list_topologies(user: dict = Depends(get_current_user)):
    return await owned_list(db.topologies, user["user_id"])


@api_router.post("/topologies")
async def create_topology(body: TopologyModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"owner_id": user["user_id"], "created_at": now_iso(), "deleted_at": None})
    await db.topologies.insert_one(dict(doc))
    return strip_id(doc)


@api_router.put("/topologies/{item_id}")
async def update_topology(item_id: str, body: TopologyModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = item_id
    await db.topologies.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": doc})
    return await db.topologies.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/topologies/{item_id}")
async def delete_topology(item_id: str, user: dict = Depends(get_current_user)):
    await db.topologies.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


# ---- Floor plans ----
@api_router.get("/floorplans")
async def list_floorplans(user: dict = Depends(get_current_user)):
    return await owned_list(db.floorplans, user["user_id"])


@api_router.post("/floorplans")
async def create_floorplan(body: FloorPlanModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"owner_id": user["user_id"], "created_at": now_iso(), "deleted_at": None})
    await db.floorplans.insert_one(dict(doc))
    return strip_id(doc)


@api_router.put("/floorplans/{item_id}")
async def update_floorplan(item_id: str, body: FloorPlanModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = item_id
    await db.floorplans.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": doc})
    return await db.floorplans.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/floorplans/{item_id}")
async def delete_floorplan(item_id: str, user: dict = Depends(get_current_user)):
    await db.floorplans.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


# ---- File upload / download ----
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = (file.filename or "img").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "heic", "svg", "pdf"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    data = await file.read()
    ctype = "image/svg+xml" if ext == "svg" else "application/pdf" if ext == "pdf" else (file.content_type or "image/jpeg")
    result = await run_in_threadpool(put_object, path, data, ctype)
    return {"path": result["path"]}


# ---- Alertas por e-mail (SMTP) ----
import smtplib
import asyncio
from email.message import EmailMessage


def send_mail(cfg: dict, subject: str, body: str, to: Optional[str] = None):
    msg = EmailMessage()
    msg["From"] = cfg.get("smtp_from") or cfg.get("smtp_user")
    msg["To"] = to or cfg["alert_email"]
    msg["Subject"] = subject
    msg.set_content(body)
    port = int(cfg.get("smtp_port") or 587)
    if port == 465:
        with smtplib.SMTP_SSL(cfg["smtp_host"], port, timeout=20) as srv:
            srv.login(cfg["smtp_user"], cfg["smtp_pass"])
            srv.send_message(msg)
    else:
        with smtplib.SMTP(cfg["smtp_host"], port, timeout=20) as srv:
            srv.starttls()
            srv.login(cfg["smtp_user"], cfg["smtp_pass"])
            srv.send_message(msg)


@api_router.post("/settings/test-email")
async def test_email(user: dict = Depends(get_current_user)):
    cfg = await db.settings.find_one({"owner_id": user["user_id"]}, {"_id": 0})
    if not cfg or not cfg.get("smtp_host") or not cfg.get("alert_email"):
        raise HTTPException(status_code=400, detail="Configure servidor SMTP e e-mail de alerta")
    try:
        await run_in_threadpool(send_mail, cfg, "Zatriz — teste de e-mail", "Configuração de e-mail funcionando. Você receberá alertas de servidores offline e preventivas vencidas.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Falha no envio: {e}")
    return {"ok": True}


# ---- Redefinição de senha (código por e-mail) ----
import hmac
import hashlib
import secrets

RESET_MINUTES = 15
RESET_MAX_ATTEMPTS = 5


def _reset_digest(code: str) -> str:
    pepper = os.environ.get("RESET_PEPPER") or (os.environ.get("MONGO_URL") or "zatriz")
    return hmac.new(pepper.encode(), code.encode(), hashlib.sha256).hexdigest()


async def _mail_config_for(user: Optional[dict]) -> Optional[dict]:
    """SMTP do próprio dono (ou do admin pai) e, se não houver, de qualquer admin configurado."""
    ids = []
    if user:
        ids.append(user.get("parent_id") or user["user_id"])
    for uid in ids:
        cfg = await db.settings.find_one({"owner_id": uid, "smtp_host": {"$nin": ["", None]}}, {"_id": 0})
        if cfg:
            return cfg
    async for adm in db.users.find({"role": "admin"}, {"_id": 0, "user_id": 1}):
        cfg = await db.settings.find_one({"owner_id": adm["user_id"], "smtp_host": {"$nin": ["", None]}}, {"_id": 0})
        if cfg:
            return cfg
    return None


class ForgotInput(BaseModel):
    email: str


class ResetInput(BaseModel):
    email: str
    code: str
    new_password: str


@api_router.post("/auth/forgot-password")
async def forgot_password(body: ForgotInput, request: Request):
    email = body.email.strip().lower()
    generic = {"ok": True, "message": "Se existir uma conta com este e-mail, enviamos um código de redefinição."}
    ip = request.client.host if request.client else "?"
    since = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    recent = await db.password_resets.count_documents({"$or": [{"email": email}, {"ip": ip}], "created_at": {"$gt": since}})
    if recent >= 3:
        return generic
    user = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1, "parent_id": 1, "name": 1})
    cfg = await _mail_config_for(user)
    if not cfg:
        raise HTTPException(status_code=400, detail="Envio de e-mail não configurado. Peça ao administrador para configurar o SMTP em Configurações.")
    if not user:
        return generic
    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.password_resets.delete_many({"user_id": user["user_id"], "used_at": None})
    await db.password_resets.insert_one({
        "user_id": user["user_id"], "email": email, "ip": ip, "code_hash": _reset_digest(code), "attempts": 0,
        "created_at": now_iso(), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=RESET_MINUTES)).isoformat(), "used_at": None,
    })
    try:
        await run_in_threadpool(send_mail, cfg, "Zatriz — código para redefinir a senha",
                                f"Olá {user.get('name') or ''},\n\nSeu código para redefinir a senha é: {code}\n\nEle vale por {RESET_MINUTES} minutos. Se você não pediu a redefinição, ignore este e-mail.", email)
    except Exception as e:
        logger.warning(f"forgot-password mail failed: {e}")
        await db.password_resets.delete_many({"user_id": user["user_id"], "used_at": None})
        raise HTTPException(status_code=400, detail="Não foi possível enviar o e-mail. Verifique a configuração SMTP.")
    return generic


@api_router.post("/auth/reset-password")
async def reset_password(body: ResetInput):
    email = body.email.strip().lower()
    invalid = HTTPException(status_code=400, detail="Código inválido ou expirado")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="A nova senha deve ter pelo menos 6 caracteres")
    user = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1})
    if not user:
        raise invalid
    r = await db.password_resets.find_one({"user_id": user["user_id"], "used_at": None, "expires_at": {"$gt": now_iso()}}, sort=[("created_at", -1)])
    if not r or r["attempts"] >= RESET_MAX_ATTEMPTS:
        raise invalid
    await db.password_resets.update_one({"_id": r["_id"]}, {"$inc": {"attempts": 1}})
    if not hmac.compare_digest(r["code_hash"], _reset_digest(body.code.strip())):
        raise invalid
    consumed = await db.password_resets.find_one_and_update({"_id": r["_id"], "used_at": None}, {"$set": {"used_at": now_iso()}})
    if not consumed:
        raise invalid
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"password_hash": hash_pw(body.new_password)}})
    await db.user_sessions.delete_many({"user_id": user["user_id"]})
    return {"ok": True, "message": "Senha redefinida. Entre novamente."}


@api_router.delete("/admin/subscribers/{user_id}")
async def admin_delete_subscriber(user_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Somente administradores")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Assinante não encontrado")
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Não é possível excluir um administrador")
    ops = [o["user_id"] async for o in db.users.find({"parent_id": user_id}, {"_id": 0, "user_id": 1})]
    ids = [user_id, *ops]
    await db.user_sessions.delete_many({"user_id": {"$in": ids}})
    await db.password_resets.delete_many({"user_id": {"$in": ids}})
    await db.users.delete_many({"user_id": {"$in": ids}})
    return {"ok": True}


async def alerts_loop():
    while True:
        try:
            async for cfg in db.settings.find({"alerts_enabled": True, "smtp_host": {"$ne": ""}, "alert_email": {"$ne": ""}}, {"_id": 0}):
                uid = cfg["owner_id"]
                # servidores: verifica e avisa quando ficar offline
                for srv in await owned_list(db.servers, uid):
                    ok, latency = await run_in_threadpool(tcp_check, srv.get("host", ""), int(srv.get("port", 443)))
                    new_status = "online" if ok else "offline"
                    await db.servers.update_one({"id": srv["id"]}, {"$set": {"status": new_status, "latency_ms": latency, "last_check": now_iso()}})
                    if new_status == "offline" and srv.get("status") != "offline":
                        await run_in_threadpool(send_mail, cfg, f"[Zatriz] Servidor OFFLINE: {srv['name']}", f"O servidor {srv['name']} ({srv.get('city','')}) não respondeu na porta {srv.get('port')} em {now_iso()}.")
                # preventivas: resumo diário
                today = datetime.now(timezone.utc).date().isoformat()
                if cfg.get("last_preventive_digest") != today:
                    overdue = [d for d in (decorate_device(x) for x in await owned_list(db.devices, uid)) if d["preventive_state"] in ("vencida", "proxima")]
                    if overdue:
                        lines = [f"- {d['name']} (pat. {d.get('asset_tag') or '-'}, {d.get('sector') or '-'}): {d['preventive_state']} — {d.get('preventive_days_left')} dia(s)" for d in overdue]
                        await run_in_threadpool(send_mail, cfg, f"[Zatriz] {len(overdue)} preventiva(s) vencida(s)/próximas", "Dispositivos com manutenção preventiva vencida ou vencendo em 15 dias:\n\n" + "\n".join(lines))
                    await db.settings.update_one({"owner_id": uid}, {"$set": {"last_preventive_digest": today}})
        except Exception as e:
            logger.warning(f"alerts loop error: {e}")
        await asyncio.sleep(1800)


@app.on_event("startup")
async def start_alerts():
    asyncio.create_task(alerts_loop())


# ---- Manual do usuário (PDF) ----
@api_router.get("/docs/manual")
async def get_manual(token: Optional[str] = None, authorization: Optional[str] = Header(None)):
    auth = authorization or (f"Bearer {token}" if token else None)
    await get_current_user(None, auth)
    path = os.path.join(os.path.dirname(__file__), "..", "docs", "manual-inframanager.pdf")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Manual não encontrado")
    return FileResponse(path, media_type="application/pdf", filename="manual-inframanager.pdf")


# ---- Geo (estados e municípios do Brasil) ----
_GEO = json.load(open(os.path.join(os.path.dirname(__file__), "br_cities.json"), encoding="utf-8"))


@api_router.get("/geo/states")
async def geo_states():
    return _GEO["states"]


@api_router.get("/geo/cities")
async def geo_cities(uf: str):
    return [{"name": c[0], "lat": c[1], "lon": c[2]} for c in _GEO["cities"].get(uf.upper(), [])]


# ---- Settings / branding ----
class SettingsModel(BaseModel):
    company_name: Optional[str] = ""
    logo_path: Optional[str] = ""
    login_image_path: Optional[str] = ""
    tutorial_pdf_url: Optional[str] = ""
    tutorial_video_url: Optional[str] = ""
    latency_warn_ms: int = 300
    smtp_host: Optional[str] = ""
    smtp_port: int = 587
    smtp_user: Optional[str] = ""
    smtp_pass: Optional[str] = ""
    smtp_from: Optional[str] = ""
    alert_email: Optional[str] = ""
    alerts_enabled: bool = False


@api_router.get("/branding")
async def public_branding():
    admin = await db.users.find_one({"role": "admin"}, {"_id": 0, "user_id": 1})
    doc = await db.settings.find_one({"owner_id": admin["user_id"]}, {"_id": 0}) if admin else None
    if not doc:
        return {"company_name": "", "logo_data_url": "", "login_image_url": "", "tutorial_pdf_url": "", "tutorial_video_url": ""}
    try:
        logo = await run_in_threadpool(logo_data_url, doc.get("logo_path") or "")
        login_img = await run_in_threadpool(logo_data_url, doc.get("login_image_path") or "")
    except Exception:
        logo, login_img = "", ""
    return {"company_name": doc.get("company_name", ""), "logo_data_url": logo, "login_image_url": login_img, "tutorial_pdf_url": doc.get("tutorial_pdf_url", ""), "tutorial_video_url": doc.get("tutorial_video_url", "")}


_logo_cache: dict = {}


def logo_data_url(path: str) -> str:
    if not path:
        return ""
    if path in _logo_cache:
        return _logo_cache[path]
    content, ctype = get_object(path)
    if path.endswith(".svg"):
        ctype = "image/svg+xml"
    import base64

    url = f"data:{ctype};base64," + base64.b64encode(content).decode()
    _logo_cache[path] = url
    return url


@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"owner_id": user["user_id"]}, {"_id": 0}) or {"owner_id": user["user_id"], **SettingsModel().model_dump()}
    try:
        doc["logo_data_url"] = await run_in_threadpool(logo_data_url, doc.get("logo_path") or "")
    except Exception as e:
        logger.warning(f"logo fetch failed: {e}")
        doc["logo_data_url"] = ""
    return doc


ADMIN_ONLY_SETTINGS = ("tutorial_pdf_url", "tutorial_video_url", "login_image_path")


@api_router.put("/settings")
async def put_settings(body: SettingsModel, user: dict = Depends(get_current_user)):
    if user.get("role") == "operator":
        raise HTTPException(status_code=403, detail="Operadores não podem alterar as configurações")
    doc = body.model_dump()
    if user.get("role") != "admin":
        for k in ADMIN_ONLY_SETTINGS:
            doc.pop(k, None)
    await db.settings.update_one({"owner_id": user["user_id"]}, {"$set": doc}, upsert=True)
    return await get_settings(user)


@api_router.get("/files/{file_path:path}")
async def download_file(file_path: str, token: Optional[str] = None, authorization: Optional[str] = Header(None)):
    auth = authorization
    if not auth and token:
        auth = f"Bearer {token}"
    await get_current_user(None, auth)
    content, ctype = await run_in_threadpool(get_object, file_path)
    return Response(content=content, media_type=ctype)


# ---- Servers ----
def tcp_check(host: str, port: int, timeout: float = 4.0):
    start = datetime.now(timezone.utc)
    try:
        with socket.create_connection((host, port), timeout=timeout):
            latency = (datetime.now(timezone.utc) - start).total_seconds() * 1000
            return True, round(latency, 1)
    except Exception:
        return False, None


@api_router.get("/servers")
async def list_servers(user: dict = Depends(get_current_user)):
    return await owned_list(db.servers, user["user_id"])


@api_router.post("/servers")
async def create_server(body: ServerModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    if not doc.get("agent_key"):
        doc["agent_key"] = uuid.uuid4().hex
    doc.update({"owner_id": user["user_id"], "created_at": now_iso(), "deleted_at": None})
    await db.servers.insert_one(dict(doc))
    return strip_id(doc)


@api_router.put("/servers/{item_id}")
async def update_server(item_id: str, body: ServerModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = item_id
    # never let the client overwrite agent data
    for k in ("agent_key", "metrics", "metrics_history", "status", "latency_ms", "last_check"):
        doc.pop(k, None)
    existing = await db.servers.find_one({"id": item_id, "owner_id": user["user_id"]}, {"_id": 0})
    if existing and not existing.get("agent_key"):
        doc["agent_key"] = uuid.uuid4().hex
    await db.servers.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": doc})
    return await db.servers.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/servers/{item_id}")
async def delete_server(item_id: str, user: dict = Depends(get_current_user)):
    await db.servers.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


@api_router.post("/servers/{item_id}/check")
async def check_server(item_id: str, user: dict = Depends(get_current_user)):
    srv = await db.servers.find_one({"id": item_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not srv:
        raise HTTPException(status_code=404, detail="Server not found")
    ok, latency = await run_in_threadpool(tcp_check, srv.get("host", ""), int(srv.get("port", 443)))
    update = {"status": "online" if ok else "offline", "latency_ms": latency, "last_check": now_iso()}
    await db.servers.update_one({"id": item_id}, {"$set": update})
    return {**srv, **update}


@api_router.post("/servers/check-all")
async def check_all_servers(user: dict = Depends(get_current_user)):
    servers = await owned_list(db.servers, user["user_id"])
    results = []
    for srv in servers:
        ok, latency = await run_in_threadpool(tcp_check, srv.get("host", ""), int(srv.get("port", 443)))
        update = {"status": "online" if ok else "offline", "latency_ms": latency, "last_check": now_iso()}
        await db.servers.update_one({"id": srv["id"]}, {"$set": update})
        results.append({**srv, **update})
    return results


# ---- Monitoring agent ----
class AgentMetrics(BaseModel):
    cpu: Optional[float] = None
    mem: Optional[float] = None
    disk: Optional[float] = None
    uptime: Optional[str] = ""
    hostname: Optional[str] = ""
    os: Optional[str] = ""


@api_router.post("/agent/metrics")
async def agent_metrics(body: AgentMetrics, x_agent_key: Optional[str] = Header(None)):
    if not x_agent_key:
        raise HTTPException(status_code=401, detail="X-Agent-Key ausente")
    srv = await db.servers.find_one({"agent_key": x_agent_key, "deleted_at": {"$in": [None, ""]}}, {"_id": 0})
    if not srv:
        raise HTTPException(status_code=401, detail="Chave de agente inválida")
    m = body.model_dump()
    m["at"] = now_iso()
    history = (srv.get("metrics_history") or [])[-47:] + [{"cpu": m["cpu"], "mem": m["mem"], "disk": m["disk"], "at": m["at"]}]
    await db.servers.update_one(
        {"id": srv["id"]},
        {"$set": {"metrics": m, "metrics_history": history, "status": "online", "last_check": m["at"]}},
    )
    return {"ok": True, "server": srv["name"], "interval_seconds": 300}


def agent_script(server: dict, base_url: str, os_name: str) -> str:
    key = server.get("agent_key", "")
    url = f"{base_url}/api/agent/metrics"
    if os_name == "windows":
        return f"""# N-Security InfraManager - Agente de monitoramento (Windows PowerShell)
# Servidor: {server.get('name')}
# Instalacao: salve como C:\\NSecurity\\agent.ps1 e crie a tarefa agendada (ver documentacao).
$Url = "{url}"
$Key = "{key}"
$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$os  = Get-CimInstance Win32_OperatingSystem
$mem = [math]::Round((($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100, 1)
$d   = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$disk = [math]::Round((($d.Size - $d.FreeSpace) / $d.Size) * 100, 1)
$up  = (Get-Date) - $os.LastBootUpTime
$body = @{{ cpu = $cpu; mem = $mem; disk = $disk; uptime = ("{{0}}d {{1}}h" -f $up.Days, $up.Hours); hostname = $env:COMPUTERNAME; os = $os.Caption }} | ConvertTo-Json
Invoke-RestMethod -Uri $Url -Method Post -Headers @{{ "X-Agent-Key" = $Key }} -ContentType "application/json" -Body $body
"""
    return f"""#!/bin/bash
# N-Security InfraManager - Agente de monitoramento (Linux)
# Servidor: {server.get('name')}
# Instalacao: salve como /opt/nsecurity/agent.sh, chmod +x e agende no cron (ver documentacao).
URL="{url}"
KEY="{key}"
CPU=$(top -bn1 | grep -i "cpu(s)" | awk '{{print 100 - $8}}')
MEM=$(free | awk '/Mem:/ {{printf "%.1f", $3/$2*100}}')
DISK=$(df / | awk 'NR==2 {{gsub("%","",$5); print $5}}')
UP=$(uptime -p | sed 's/up //')
OS=$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME")
curl -s -X POST "$URL" -H "X-Agent-Key: $KEY" -H "Content-Type: application/json" \\
  -d "{{\\"cpu\\": ${{CPU:-0}}, \\"mem\\": ${{MEM:-0}}, \\"disk\\": ${{DISK:-0}}, \\"uptime\\": \\"$UP\\", \\"hostname\\": \\"$(hostname)\\", \\"os\\": \\"$OS\\"}}"
"""


@api_router.get("/servers/{item_id}/agent-script")
async def get_agent_script(item_id: str, os: str = "linux", base: Optional[str] = None, user: dict = Depends(get_current_user)):
    srv = await db.servers.find_one({"id": item_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not srv:
        raise HTTPException(status_code=404, detail="Server not found")
    if not srv.get("agent_key"):
        srv["agent_key"] = uuid.uuid4().hex
        await db.servers.update_one({"id": item_id}, {"$set": {"agent_key": srv["agent_key"]}})
    base = (base or os_env_base_url()).rstrip("/")
    return {"os": os, "script": agent_script(srv, base, os), "agent_key": srv["agent_key"], "url": f"{base}/api/agent/metrics"}


def os_env_base_url() -> str:
    return (os.environ.get("PUBLIC_BASE_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://SEU-APP").rstrip("/")


# ---- Devices (inventário) ----
class DeviceModel(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    name: str
    kind: str = "computador"
    asset_tag: Optional[str] = ""
    serial: Optional[str] = ""
    brand: Optional[str] = ""
    model: Optional[str] = ""
    sector: Optional[str] = ""
    client_id: Optional[str] = ""
    client_name: Optional[str] = ""
    photo_path: Optional[str] = ""
    specs: dict = Field(default_factory=dict)
    preventive_months: int = 0
    last_preventive: Optional[str] = ""
    status: str = "ativo"
    notes: Optional[str] = ""


class MaintenanceModel(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    device_id: Optional[str] = ""
    kind: str = "corretiva"
    date: str = ""
    description: str = ""
    technician: Optional[str] = ""
    cost: float = 0
    parts: Optional[str] = ""


def device_next_preventive(d: dict) -> Optional[str]:
    months = int(d.get("preventive_months") or 0)
    if months <= 0:
        return None
    base = d.get("last_preventive") or d.get("created_at") or now_iso()
    try:
        dt = datetime.fromisoformat(base.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1
    day = min(dt.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return dt.replace(year=year, month=month, day=day).isoformat()


def decorate_device(d: dict) -> dict:
    nxt = device_next_preventive(d)
    d["next_preventive"] = nxt
    if nxt:
        delta = (datetime.fromisoformat(nxt) - datetime.now(timezone.utc)).days
        d["preventive_days_left"] = delta
        d["preventive_state"] = "vencida" if delta < 0 else "proxima" if delta <= 15 else "ok"
    else:
        d["preventive_days_left"] = None
        d["preventive_state"] = "sem"
    return d


@api_router.get("/devices")
async def list_devices(user: dict = Depends(get_current_user)):
    docs = await owned_list(db.devices, user["user_id"])
    return [decorate_device(d) for d in docs]


@api_router.get("/devices/find")
async def find_device(code: str, user: dict = Depends(get_current_user)):
    code = code.strip()
    if code.startswith("nsim:device:"):
        code = code.split(":", 2)[2]
    doc = await db.devices.find_one(
        {"owner_id": user["user_id"], "deleted_at": {"$in": [None, ""]}, "$or": [{"id": code}, {"asset_tag": code}, {"serial": code}]},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return decorate_device(doc)


@api_router.post("/devices")
async def create_device(body: DeviceModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"owner_id": user["user_id"], "created_at": now_iso(), "deleted_at": None})
    await db.devices.insert_one(dict(doc))
    return decorate_device(strip_id(doc))


@api_router.put("/devices/{item_id}")
async def update_device(item_id: str, body: DeviceModel, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = item_id
    await db.devices.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": doc})
    saved = await db.devices.find_one({"id": item_id}, {"_id": 0})
    return decorate_device(saved) if saved else None


@api_router.delete("/devices/{item_id}")
async def delete_device(item_id: str, user: dict = Depends(get_current_user)):
    await db.devices.update_one({"id": item_id, "owner_id": user["user_id"]}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


@api_router.get("/devices/{item_id}/maintenances")
async def list_maintenances(item_id: str, user: dict = Depends(get_current_user)):
    docs = await db.maintenances.find({"device_id": item_id, "owner_id": user["user_id"]}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda m: m.get("date", ""), reverse=True)
    return docs


@api_router.post("/devices/{item_id}/maintenances")
async def create_maintenance(item_id: str, body: MaintenanceModel, user: dict = Depends(get_current_user)):
    device = await db.devices.find_one({"id": item_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    doc = body.model_dump()
    doc.update({"device_id": item_id, "owner_id": user["user_id"], "created_at": now_iso()})
    if not doc.get("date"):
        doc["date"] = now_iso()
    await db.maintenances.insert_one(dict(doc))
    if doc["kind"] == "preventiva":
        await db.devices.update_one({"id": item_id}, {"$set": {"last_preventive": doc["date"]}})
    return strip_id(doc)


@api_router.delete("/maintenances/{item_id}")
async def delete_maintenance(item_id: str, user: dict = Depends(get_current_user)):
    await db.maintenances.delete_one({"id": item_id, "owner_id": user["user_id"]})
    return {"ok": True}


@api_router.get("/maintenances")
async def list_all_maintenances(user: dict = Depends(get_current_user)):
    docs = await db.maintenances.find({"owner_id": user["user_id"]}, {"_id": 0}).to_list(2000)
    docs.sort(key=lambda m: m.get("date", ""), reverse=True)
    return docs


# ---- Dashboard ----
@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    quotes = await owned_list(db.quotes, uid)
    servers = await owned_list(db.servers, uid)
    clients = await owned_list(db.clients, uid)
    racks = await owned_list(db.racks, uid)
    devices = [decorate_device(d) for d in await owned_list(db.devices, uid)]

    def qtotal(q):
        subtotal = sum(i.get("quantity", 0) * i.get("unit_price", 0) for i in q.get("items", []))
        return subtotal - q.get("discount", 0) + q.get("tax", 0)

    return {
        "quotes_total": len(quotes),
        "quotes_pending": len([q for q in quotes if q.get("status") == "pendente"]),
        "quotes_approved": len([q for q in quotes if q.get("status") == "aprovado"]),
        "approved_value": round(sum(qtotal(q) for q in quotes if q.get("status") == "aprovado"), 2),
        "clients_total": len(clients),
        "racks_total": len(racks),
        "servers_total": len(servers),
        "servers_offline": len([s for s in servers if s.get("status") == "offline"]),
        "servers_online": len([s for s in servers if s.get("status") == "online"]),
        "devices_total": len(devices),
        "preventive_overdue": len([d for d in devices if d["preventive_state"] == "vencida"]),
        "preventive_soon": len([d for d in devices if d["preventive_state"] == "proxima"]),
    }


@api_router.get("/")
async def root():
    return {"message": "N-Security InfraManager API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning(f"index setup: {e}")
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one(
            {
                "user_id": "user_" + uuid.uuid4().hex[:12],
                "email": ADMIN_EMAIL,
                "name": "Jesse Araujo",
                "picture": "",
                "role": "admin",
                "password_hash": hash_pw(ADMIN_PASSWORD),
                "created_at": now_iso(),
            }
        )
        logger.info("admin seeded")
    else:
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"role": "admin", "password_hash": existing.get("password_hash") or hash_pw(ADMIN_PASSWORD)}},
        )
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logger.warning(f"storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
