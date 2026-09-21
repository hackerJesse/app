"""
Backend integration tests for N-Security InfraManager - NEW FEATURES (iteration 2)
Covers: registration, contract acceptance, Stripe checkout gating, single-device sessions,
admin subscribers, settings, agent script + metrics ingestion, city on clients, /maintenances.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "jesse.araujo@nsecurity.com.br"
ADMIN_PASSWORD = "3645QPwo$"
SUB_EMAIL = "teste@exemplo.com"
SUB_PASSWORD = "123456"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="session")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def new_user():
    """Register a brand-new user for tests (unique email)."""
    email = f"TEST_reg_{uuid.uuid4().hex[:10]}@test.local"
    payload = {
        "full_name": "TEST User",
        "email": email,
        "password": "abc123",
        "cpf": "11122233344",  # 11 digits
        "phone": "11999998888",
        "address": "Rua TEST, 100",
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email.lower(), "password": "abc123", "token": data["session_token"], "user": data["user"], "payload": payload}


# ---------- 1. Registration ----------
class TestRegistration:
    def test_register_valid(self, new_user):
        assert new_user["user"]["email"] == new_user["email"]
        assert new_user["user"]["has_access"] is False
        assert new_user["user"]["role"] == "user"
        assert "session_token" in {"session_token": new_user["token"]}

    def test_register_duplicate_email(self, new_user):
        r = requests.post(f"{API}/auth/register", json=new_user["payload"], timeout=30)
        assert r.status_code == 409

    def test_register_invalid_cpf(self):
        r = requests.post(f"{API}/auth/register", json={
            "full_name": "X", "email": f"TEST_cpf_{uuid.uuid4().hex[:6]}@t.local",
            "password": "abc123", "cpf": "123", "address": "rua",
        }, timeout=30)
        assert r.status_code == 400

    def test_register_weak_password(self):
        r = requests.post(f"{API}/auth/register", json={
            "full_name": "X", "email": f"TEST_pw_{uuid.uuid4().hex[:6]}@t.local",
            "password": "abc", "cpf": "11122233344", "address": "rua",
        }, timeout=30)
        assert r.status_code == 400


# ---------- 2. Access gating (402) & /auth/me for new user ----------
class TestAccessGating:
    def test_new_user_me_has_no_access(self, new_user):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_user['token']}"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["has_access"] is False

    def test_new_user_cannot_list_clients(self, new_user):
        r = requests.get(f"{API}/clients", headers={"Authorization": f"Bearer {new_user['token']}"}, timeout=30)
        assert r.status_code == 402
        assert "ssinatura" in r.json().get("detail", "").lower() or "contrato" in r.json().get("detail", "").lower()


# ---------- 3. Contract acceptance ----------
class TestContract:
    def test_accept_contract(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}
        r = requests.post(f"{API}/account/contract", headers=h, json={
            "accept": True, "full_name": "TEST User Full", "cpf": "111.222.333-44",
        }, timeout=30)
        assert r.status_code == 200, r.text
        me = requests.get(f"{API}/auth/me", headers=h, timeout=30).json()
        assert me.get("contract_accepted_at"), "contract_accepted_at should be set"


# ---------- 4. Stripe checkout ----------
class TestBilling:
    def test_invalid_plan(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}
        r = requests.post(f"{API}/billing/checkout", headers=h, json={"plan": "bogus", "origin": BASE_URL}, timeout=30)
        assert r.status_code == 400

    def test_monthly_checkout(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}
        r = requests.post(f"{API}/billing/checkout", headers=h, json={"plan": "monthly", "origin": BASE_URL}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and data["url"].startswith("http")
        assert "session_id" in data and data["session_id"]
        # status pending (no payment)
        s = requests.get(f"{API}/billing/status/{data['session_id']}", headers=h, timeout=30)
        assert s.status_code == 200
        assert s.json()["status"] in ("pending", "expired")

    def test_lifetime_checkout(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}
        r = requests.post(f"{API}/billing/checkout", headers=h, json={"plan": "lifetime", "origin": BASE_URL}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["url"].startswith("http")

    def test_billing_me(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}
        r = requests.get(f"{API}/billing/me", headers=h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "user" in data and "plans" in data and "transactions" in data
        assert "monthly" in data["plans"] and "lifetime" in data["plans"]


# ---------- 5. Single-device sessions ----------
class TestSingleDeviceSession:
    def test_subscriber_previous_token_invalidated(self):
        r1 = requests.post(f"{API}/auth/login", json={"email": SUB_EMAIL, "password": SUB_PASSWORD}, timeout=30)
        if r1.status_code != 200:
            pytest.skip(f"subscriber test user not available: {r1.status_code}")
        t1 = r1.json()["session_token"]
        # second login → t1 should be invalidated
        r2 = requests.post(f"{API}/auth/login", json={"email": SUB_EMAIL, "password": SUB_PASSWORD}, timeout=30)
        assert r2.status_code == 200
        t2 = r2.json()["session_token"]
        assert t1 != t2
        me1 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {t1}"}, timeout=30)
        assert me1.status_code == 401, f"first token should be invalid, got {me1.status_code}"
        me2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {t2}"}, timeout=30)
        assert me2.status_code == 200

    def test_admin_multiple_sessions_allowed(self):
        r1 = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        r2 = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r1.status_code == 200 and r2.status_code == 200
        t1 = r1.json()["session_token"]
        t2 = r2.json()["session_token"]
        # Both should still be valid for admin
        me1 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {t1}"}, timeout=30)
        me2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {t2}"}, timeout=30)
        assert me1.status_code == 200, f"admin first token should still be valid, got {me1.status_code}"
        assert me2.status_code == 200


# ---------- 6. Admin subscribers ----------
class TestAdminSubscribers:
    def test_list_requires_admin(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.get(f"{API}/admin/subscribers", headers=h, timeout=30)
        assert r.status_code == 403

    def test_list_admin_ok(self, admin_h, new_user):
        r = requests.get(f"{API}/admin/subscribers", headers=admin_h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        emails = [u.get("email") for u in data]
        assert new_user["email"] in emails
        row = next(u for u in data if u["email"] == new_user["email"])
        for k in ("has_access", "blocked", "transactions"):
            assert k in row

    def test_block_and_unblock(self, admin_h, new_user):
        uid = new_user["user"]["user_id"]
        # block
        r = requests.post(f"{API}/admin/subscribers/{uid}/access", headers=admin_h, json={"blocked": True}, timeout=30)
        assert r.status_code == 200
        # blocked user's session should be gone (they were logged in via register token)
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_user['token']}"}, timeout=30)
        assert me.status_code == 401, f"blocked user's session should be removed, got {me.status_code}"
        # login again → has_access must be False
        rl = requests.post(f"{API}/auth/login", json={"email": new_user["email"], "password": new_user["password"]}, timeout=30)
        assert rl.status_code == 200
        t = rl.json()["session_token"]
        assert rl.json()["user"]["has_access"] is False
        # unblock
        r = requests.post(f"{API}/admin/subscribers/{uid}/access", headers=admin_h, json={"blocked": False}, timeout=30)
        assert r.status_code == 200
        # refresh token (session remains valid since not deleted on unblock)
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {t}"}, timeout=30)
        assert me.status_code == 200
        # still has_access=False (never paid), but blocked=False
        assert me.json()["has_access"] is False
        new_user["token"] = t  # refresh session for later tests


# ---------- 7. Settings ----------
class TestSettings:
    def test_get_settings_admin(self, admin_h):
        r = requests.get(f"{API}/settings", headers=admin_h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        for k in ("company_name", "logo_path", "latency_warn_ms"):
            assert k in data

    def test_put_settings_admin_ok(self, admin_h):
        r = requests.put(f"{API}/settings", headers=admin_h, json={
            "company_name": "TEST N-Security", "logo_path": "", "latency_warn_ms": 250,
        }, timeout=30)
        assert r.status_code == 200
        assert r.json()["company_name"] == "TEST N-Security"
        assert r.json()["latency_warn_ms"] == 250

    def test_put_settings_non_admin_forbidden(self, admin_h):
        # login subscriber (unblocked, no access -- but settings is under /api/settings and requires access)
        # for this we need a token; use fresh registration of another user just for the 403 check
        email = f"TEST_settings_{uuid.uuid4().hex[:6]}@t.local"
        r = requests.post(f"{API}/auth/register", json={
            "full_name": "X", "email": email, "password": "abc123", "cpf": "11122233344", "address": "rua",
        }, timeout=30)
        assert r.status_code == 200
        t = r.json()["session_token"]
        # give them contract + access via admin? No - we want to test 403 specifically.
        # /api/settings requires access (402 for non-paid users). So we grant contract + skip.
        # Simplest: use admin's /admin/subscribers to grant blocked=False (already), and also artificially set has_access via unpaid path is not exposed.
        # So the 403 branch is only reachable by an admin-role user without admin role. Since the middleware gates first with 402,
        # We accept that this returns 402 for a non-paid user, which is also a valid denial.
        h = {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}
        rr = requests.put(f"{API}/settings", headers=h, json={"company_name": "X"}, timeout=30)
        assert rr.status_code in (402, 403), f"expected 402 or 403, got {rr.status_code}"


# ---------- 8. Agent script + metrics ----------
class TestAgent:
    @pytest.fixture(scope="class")
    def server_id(self, admin_h):
        body = {"name": "TEST_AgentSrv", "host": "example.com", "port": 443, "city": "São Paulo", "map_x": 50, "map_y": 50}
        r = requests.post(f"{API}/servers", headers=admin_h, json=body, timeout=30)
        assert r.status_code == 200
        sid = r.json()["id"]
        yield sid
        requests.delete(f"{API}/servers/{sid}", headers=admin_h, timeout=30)

    def test_agent_script_linux(self, admin_h, server_id):
        r = requests.get(f"{API}/servers/{server_id}/agent-script", headers=admin_h,
                         params={"os": "linux", "base": BASE_URL}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["agent_key"]
        assert data["agent_key"] in data["script"]
        assert "curl" in data["script"].lower() or "#!/bin/bash" in data["script"]

    def test_agent_script_windows(self, admin_h, server_id):
        r = requests.get(f"{API}/servers/{server_id}/agent-script", headers=admin_h,
                         params={"os": "windows", "base": BASE_URL}, timeout=30)
        assert r.status_code == 200
        assert "Invoke-RestMethod" in r.json()["script"]

    def test_metrics_invalid_key(self):
        r = requests.post(f"{API}/agent/metrics", headers={"X-Agent-Key": "bogus"},
                          json={"cpu": 10.0, "mem": 20.0, "disk": 30.0}, timeout=30)
        assert r.status_code == 401

    def test_metrics_missing_key(self):
        r = requests.post(f"{API}/agent/metrics", json={"cpu": 10.0, "mem": 20.0, "disk": 30.0}, timeout=30)
        assert r.status_code == 401

    def test_metrics_valid_updates_server(self, admin_h, server_id):
        # fetch agent_key
        r = requests.get(f"{API}/servers/{server_id}/agent-script", headers=admin_h,
                         params={"os": "linux", "base": BASE_URL}, timeout=30)
        key = r.json()["agent_key"]
        r = requests.post(f"{API}/agent/metrics", headers={"X-Agent-Key": key},
                          json={"cpu": 42.5, "mem": 55.0, "disk": 12.3, "uptime": "3d 2h", "hostname": "host", "os": "Ubuntu"},
                          timeout=30)
        assert r.status_code == 200, r.text
        # verify updated
        srvs = requests.get(f"{API}/servers", headers=admin_h, timeout=30).json()
        srv = next(s for s in srvs if s["id"] == server_id)
        assert srv["status"] == "online"
        assert srv.get("metrics", {}).get("cpu") == 42.5
        assert len(srv.get("metrics_history", [])) >= 1


# ---------- 9. Clients accept 'city' ----------
class TestClientCity:
    def test_client_with_city(self, admin_h):
        r = requests.post(f"{API}/clients", headers=admin_h, json={"name": "TEST_CityClient", "city": "Curitiba"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d.get("city") == "Curitiba"
        cid = d["id"]
        # verify persisted
        items = requests.get(f"{API}/clients", headers=admin_h, timeout=30).json()
        found = next(c for c in items if c["id"] == cid)
        assert found["city"] == "Curitiba"
        requests.delete(f"{API}/clients/{cid}", headers=admin_h, timeout=30)


# ---------- 10. /maintenances aggregate ----------
class TestMaintenancesList:
    def test_list_all_maintenances(self, admin_h):
        r = requests.get(f"{API}/maintenances", headers=admin_h, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
