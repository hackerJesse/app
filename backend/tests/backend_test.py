"""
Backend integration tests for N-Security InfraManager
Covers: auth, clients, quotes, racks, topologies, floorplans, servers, devices, maintenances, dashboard
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://vendor-rack-plan.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "jesse.araujo@nsecurity.com.br"
ADMIN_PASSWORD = "3645QPwo$"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["session_token"]


@pytest.fixture(scope="session")
def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_login_valid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "session_token" in data and data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_me(self, h):
        r = requests.get(f"{API}/auth/me", headers=h, timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401


# ---------- Clients ----------
class TestClients:
    def test_client_crud(self, h):
        payload = {"name": "TEST_Client_A", "company": "TEST_Co", "email": "t@test.com"}
        r = requests.post(f"{API}/clients", headers=h, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        # list
        r = requests.get(f"{API}/clients", headers=h, timeout=30)
        assert r.status_code == 200
        assert any(c["id"] == cid for c in r.json())
        # update
        r = requests.put(f"{API}/clients/{cid}", headers=h, json={**payload, "id": cid, "name": "TEST_Client_B"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Client_B"
        # delete
        r = requests.delete(f"{API}/clients/{cid}", headers=h, timeout=30)
        assert r.status_code == 200
        r = requests.get(f"{API}/clients", headers=h, timeout=30)
        assert not any(c["id"] == cid for c in r.json())


# ---------- Quotes ----------
class TestQuotes:
    def test_quote_crud_and_status(self, h):
        body = {
            "client_name": "TEST_Client",
            "kind": "venda",
            "status": "rascunho",
            "items": [{"description": "TEST item", "quantity": 2, "unit_price": 100.0}],
        }
        r = requests.post(f"{API}/quotes", headers=h, json=body, timeout=30)
        assert r.status_code == 200, r.text
        q = r.json()
        assert q.get("number", "").startswith("ORC-")
        qid = q["id"]
        # patch status
        r = requests.patch(f"{API}/quotes/{qid}/status", headers=h, json={"status": "aprovado"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "aprovado"
        # delete
        requests.delete(f"{API}/quotes/{qid}", headers=h, timeout=30)


# ---------- Racks ----------
class TestRacks:
    def test_rack_crud(self, h):
        body = {"name": "TEST_Rack", "size_u": 48, "slots": [{"u_start": 1, "u_size": 2, "kind": "switch", "label": "Sw1"}]}
        r = requests.post(f"{API}/racks", headers=h, json=body, timeout=30)
        assert r.status_code == 200
        rid = r.json()["id"]
        r = requests.get(f"{API}/racks", headers=h, timeout=30)
        assert any(x["id"] == rid for x in r.json())
        requests.delete(f"{API}/racks/{rid}", headers=h, timeout=30)


# ---------- Topologies ----------
class TestTopologies:
    def test_topology_crud(self, h):
        body = {"name": "TEST_Topo", "nodes": [{"id": "n1", "kind": "pc", "label": "PC1", "x": 10, "y": 10}], "links": []}
        r = requests.post(f"{API}/topologies", headers=h, json=body, timeout=30)
        assert r.status_code == 200
        tid = r.json()["id"]
        requests.delete(f"{API}/topologies/{tid}", headers=h, timeout=30)


# ---------- Floorplans ----------
class TestFloorplans:
    def test_floorplan_crud_with_rooms(self, h):
        body = {
            "name": "TEST_Plan",
            "mode": "draw",
            "rooms": [{"id": "r1", "x": 10, "y": 10, "w": 30, "h": 20, "label": "TI"}],
            "points": [{"id": "p1", "x": 25, "y": 25, "label": "Ponto", "kind": "network"}],
        }
        r = requests.post(f"{API}/floorplans", headers=h, json=body, timeout=30)
        assert r.status_code == 200
        fid = r.json()["id"]
        r2 = requests.get(f"{API}/floorplans", headers=h, timeout=30)
        found = next((x for x in r2.json() if x["id"] == fid), None)
        assert found and len(found["rooms"]) == 1 and len(found["points"]) == 1
        requests.delete(f"{API}/floorplans/{fid}", headers=h, timeout=30)


# ---------- Servers ----------
class TestServers:
    def test_server_flow(self, h):
        body = {"name": "TEST_Server", "host": "google.com", "port": 443, "city": "São Paulo", "map_x": 50, "map_y": 50}
        r = requests.post(f"{API}/servers", headers=h, json=body, timeout=30)
        assert r.status_code == 200
        sid = r.json()["id"]
        # check single
        r = requests.post(f"{API}/servers/{sid}/check", headers=h, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] in ("online", "offline")
        # check-all
        r = requests.post(f"{API}/servers/check-all", headers=h, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        requests.delete(f"{API}/servers/{sid}", headers=h, timeout=30)


# ---------- Devices + Maintenances ----------
class TestDevicesAndMaintenances:
    def test_full_device_flow(self, h):
        body = {
            "name": "TEST_Notebook",
            "kind": "notebook",
            "asset_tag": "TEST-AT-0001",
            "serial": "TEST-SN-9999",
            "sector": "TI",
            "specs": {"cpu": "i7"},
            "preventive_months": 6,
        }
        r = requests.post(f"{API}/devices", headers=h, json=body, timeout=30)
        assert r.status_code == 200
        d = r.json()
        did = d["id"]
        assert d["preventive_state"] in ("ok", "proxima", "vencida", "sem")

        # find by nsim:device:<id>
        r = requests.get(f"{API}/devices/find", headers=h, params={"code": f"nsim:device:{did}"}, timeout=30)
        assert r.status_code == 200 and r.json()["id"] == did
        # find by asset_tag
        r = requests.get(f"{API}/devices/find", headers=h, params={"code": "TEST-AT-0001"}, timeout=30)
        assert r.status_code == 200
        # find by serial
        r = requests.get(f"{API}/devices/find", headers=h, params={"code": "TEST-SN-9999"}, timeout=30)
        assert r.status_code == 200
        # find unknown
        r = requests.get(f"{API}/devices/find", headers=h, params={"code": "unknown-xyz"}, timeout=30)
        assert r.status_code == 404

        # add corrective maintenance
        r = requests.post(f"{API}/devices/{did}/maintenances", headers=h,
                          json={"device_id": did, "kind": "corretiva", "description": "TEST fix"}, timeout=30)
        assert r.status_code == 200
        mid_c = r.json()["id"]

        # add preventive maintenance -> should update last_preventive
        r = requests.post(f"{API}/devices/{did}/maintenances", headers=h,
                          json={"device_id": did, "kind": "preventiva", "description": "TEST prev"}, timeout=30)
        assert r.status_code == 200
        mid_p = r.json()["id"]

        # list maintenances
        r = requests.get(f"{API}/devices/{did}/maintenances", headers=h, timeout=30)
        assert r.status_code == 200 and len(r.json()) >= 2

        # verify last_preventive updated and next_preventive computed
        r = requests.get(f"{API}/devices", headers=h, timeout=30)
        dev = next(x for x in r.json() if x["id"] == did)
        assert dev.get("last_preventive"), "last_preventive should be set after preventiva"
        assert dev.get("next_preventive"), "next_preventive should be computed"

        # delete maintenance
        r = requests.delete(f"{API}/maintenances/{mid_c}", headers=h, timeout=30)
        assert r.status_code == 200

        # cleanup
        requests.delete(f"{API}/maintenances/{mid_p}", headers=h, timeout=30)
        requests.delete(f"{API}/devices/{did}", headers=h, timeout=30)


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_keys(self, h):
        r = requests.get(f"{API}/dashboard", headers=h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        for k in ("devices_total", "preventive_overdue", "preventive_soon", "quotes_total", "servers_total", "clients_total"):
            assert k in data, f"missing {k}"
