from tests.conftest import signup

BASE = "/api/v1/vocab-sets"


def card(word="hello", **kw):
    return {"word": word, "translation": f"nghĩa của {word}", **kw}


async def make_set(api, h, title="Du lịch"):
    return (await api.post(BASE, json={"title": title}, headers=h)).json()["data"]


async def add_group(api, h, sid, title="Nhóm 1"):
    d = (await api.post(f"{BASE}/{sid}/groups", json={"title": title}, headers=h)).json()["data"]
    return d["groups"][-1]["id"]


async def add_cards(api, h, sid, gid, words):
    return [(await api.post(f"{BASE}/{sid}/groups/{gid}/cards", json=card(w), headers=h)).json()["data"] for w in words]


async def test_a_new_set_is_a_private_draft_owned_by_its_creator(api, db):
    ha, hb = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby")
    s = await make_set(api, ha)
    assert s["status"] == "draft" and s["group_count"] == 0 and s["card_count"] == 0 and s["owner"]["username"] == "alice"
    assert [x["id"] for x in (await api.get(f"{BASE}?scope=mine", headers=ha)).json()["data"]] == [s["id"]]
    assert (await api.get(f"{BASE}?scope=public", headers=ha)).json()["data"] == []                 # drafts are not shared
    assert (await api.get(f"{BASE}/{s['id']}", headers=hb)).status_code == 404                      # other people cannot even see it
    assert (await api.get(BASE)).status_code == 401
    assert (await api.post(BASE, json={"title": "  "}, headers=ha)).status_code == 422


async def test_groups_can_be_added_renamed_reordered_and_deleted_with_their_cards(api, db):
    h = await signup(api)
    s = await make_set(api, h)
    g1, g2, g3 = [await add_group(api, h, s["id"], f"G{i}") for i in (1, 2, 3)]
    await add_cards(api, h, s["id"], g2, ["one", "two"])
    r = (await api.post(f"{BASE}/{s['id']}/groups/reorder", json={"ids": [g3, g1, g2]}, headers=h)).json()["data"]
    assert [g["title"] for g in r["groups"]] == ["G3", "G1", "G2"] and r["groups"][2]["count"] == 2
    assert (await api.post(f"{BASE}/{s['id']}/groups/reorder", json={"ids": [g3, g1]}, headers=h)).status_code == 422   # must list every group
    r = (await api.patch(f"{BASE}/{s['id']}/groups/{g1}", json={"title": "Sân bay"}, headers=h)).json()["data"]
    assert r["groups"][1]["title"] == "Sân bay"
    r = (await api.delete(f"{BASE}/{s['id']}/groups/{g2}", headers=h)).json()["data"]
    assert [g["id"] for g in r["groups"]] == [g3, g1] and await db["vocab_cards"].count_documents({}) == 0
    assert (await api.delete(f"{BASE}/{s['id']}/groups/nope", headers=h)).status_code == 404


async def test_group_limit(api, db):
    h = await signup(api)
    s = await make_set(api, h)
    from bson import ObjectId

    await db["vocab_sets"].update_one({"_id": ObjectId(s["id"])}, {"$set": {"groups": [{"id": f"g{i}", "title": f"G{i}"} for i in range(30)]}})
    assert (await api.post(f"{BASE}/{s['id']}/groups", json={"title": "one too many"}, headers=h)).status_code == 409


async def test_cards_validation_edit_move_reorder_delete(api, db):
    h = await signup(api)
    s = await make_set(api, h)
    g1, g2 = await add_group(api, h, s["id"], "A"), await add_group(api, h, s["id"], "B")
    full = {"word": "abandon", "phonetic": "/əˈbændən/", "translation": "từ bỏ", "pos": "verb", "definition_en": "to leave", "definition_vi": "rời bỏ",
            "example_en": "He abandoned it.", "example_vi": "Anh ấy bỏ nó."}
    c = (await api.post(f"{BASE}/{s['id']}/groups/{g1}/cards", json=full, headers=h)).json()["data"]
    assert {k: c[k] for k in full} == full and c["group_id"] == g1
    for bad in ({"word": "x"}, {**full, "pos": "wizard"}, {**full, "word": ""}, {**full, "translation": " "}):
        assert (await api.post(f"{BASE}/{s['id']}/groups/{g1}/cards", json=bad, headers=h)).status_code == 422
    assert (await api.post(f"{BASE}/{s['id']}/groups/nope/cards", json=card(), headers=h)).status_code == 404
    c2, c3 = await add_cards(api, h, s["id"], g1, ["second", "third"])
    assert [x["word"] for x in (await api.get(f"{BASE}/{s['id']}/cards?group={g1}", headers=h)).json()["data"]] == ["abandon", "second", "third"]
    order = (await api.post(f"{BASE}/{s['id']}/groups/{g1}/cards/reorder", json={"ids": [c3["id"], c["id"], c2["id"]]}, headers=h)).json()["data"]
    assert [x["word"] for x in order] == ["third", "abandon", "second"]
    assert (await api.post(f"{BASE}/{s['id']}/groups/{g1}/cards/reorder", json={"ids": [c["id"]]}, headers=h)).status_code == 422
    e = (await api.patch(f"{BASE}/{s['id']}/cards/{c2['id']}", json={"translation": "thứ hai", "group_id": g2}, headers=h)).json()["data"]
    assert e["translation"] == "thứ hai" and e["group_id"] == g2 and e["word"] == "second"             # moved to the other group
    assert (await api.patch(f"{BASE}/{s['id']}/cards/{c2['id']}", json={"group_id": "nope"}, headers=h)).status_code == 404
    assert (await api.delete(f"{BASE}/{s['id']}/cards/{c3['id']}", headers=h)).status_code == 200
    all_cards = (await api.get(f"{BASE}/{s['id']}/cards", headers=h)).json()["data"]
    assert [x["word"] for x in all_cards] == ["abandon", "second"]                                       # grouped in the order of the groups
    d = (await api.get(f"{BASE}/{s['id']}", headers=h)).json()["data"]
    assert [g["count"] for g in d["groups"]] == [1, 1] and d["card_count"] == 2 and d["is_owner"]


async def test_publishing_needs_a_confirmation_and_enough_cards_and_can_be_undone(api, db):
    ha, hb = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby")
    s = await make_set(api, ha, "Ẩm thực")
    g = await add_group(api, ha, s["id"])
    await add_cards(api, ha, s["id"], g, ["a1", "a2", "a3"])
    pub = f"{BASE}/{s['id']}/publish"
    assert (await api.post(pub, json={}, headers=ha)).json()["error_code"] == "CONFIRM_REQUIRED"        # no confirmation, no sharing
    assert (await api.post(pub, json={"confirm": True}, headers=ha)).json()["error_code"] == "NEED_MORE_CARDS"
    await add_cards(api, ha, s["id"], g, ["a4"])
    assert (await api.post(pub, json={"confirm": True}, headers=hb)).status_code == 404                  # not bobby's (and he cannot see it)
    d = (await api.post(pub, json={"confirm": True}, headers=ha)).json()["data"]
    assert d["status"] == "public" and d["published_at"]
    listing = (await api.get(f"{BASE}?scope=public", headers=hb)).json()
    assert [x["title"] for x in listing["data"]] == ["Ẩm thực"] and listing["data"][0]["card_count"] == 4 and listing["meta"]["total"] == 1
    assert [x["title"] for x in (await api.get(f"{BASE}?q=ẩm", headers=hb)).json()["data"]] == ["Ẩm thực"] and (await api.get(f"{BASE}?q=zzz", headers=hb)).json()["data"] == []
    seen = (await api.get(f"{BASE}/{s['id']}", headers=hb)).json()["data"]                               # everybody can read it …
    assert seen["is_owner"] is False and len((await api.get(f"{BASE}/{s['id']}/cards", headers=hb)).json()["data"]) == 4
    assert (await api.patch(f"{BASE}/{s['id']}", json={"title": "hacked"}, headers=hb)).status_code == 403   # … but only the owner can change it
    assert (await api.post(f"{BASE}/{s['id']}/groups", json={"title": "x"}, headers=hb)).status_code == 403
    assert (await api.delete(f"{BASE}/{s['id']}", headers=hb)).status_code == 403
    assert (await api.post(f"{BASE}/{s['id']}/unpublish", headers=ha)).json()["data"]["status"] == "draft"
    assert (await api.get(f"{BASE}?scope=public", headers=hb)).json()["data"] == [] and (await api.get(f"{BASE}/{s['id']}", headers=hb)).status_code == 404


async def test_admin_can_moderate_but_not_edit_and_delete_cascades(api, db):
    ha, hx = await signup(api, "a@x.com", "alice"), await signup(api, "x@x.com", "boss")
    await db["users"].update_one({"email": "x@x.com"}, {"$set": {"role": "admin"}})
    s = await make_set(api, ha)
    g = await add_group(api, ha, s["id"])
    cards = await add_cards(api, ha, s["id"], g, ["a1", "a2", "a3", "a4"])
    await api.post(f"{BASE}/{s['id']}/study/answer", json={"card_id": cards[0]["id"], "correct": True}, headers=ha)
    assert (await api.get(f"{BASE}/{s['id']}", headers=hx)).status_code == 200                         # an admin may look at drafts
    assert (await api.patch(f"{BASE}/{s['id']}", json={"title": "x"}, headers=hx)).status_code == 403  # but not rewrite them
    assert (await api.delete(f"{BASE}/{s['id']}", headers=hx)).status_code == 200
    assert await db["vocab_sets"].count_documents({}) == 0 and await db["vocab_cards"].count_documents({}) == 0 and await db["card_study"].count_documents({}) == 0


async def test_set_rename_and_reorder_and_limits(api, db):
    h = await signup(api)
    a, b, c = [await make_set(api, h, t) for t in ("A", "B", "C")]
    assert [x["title"] for x in (await api.get(f"{BASE}?scope=mine", headers=h)).json()["data"]] == ["A", "B", "C"]
    r = (await api.post(f"{BASE}/reorder", json={"ids": [c["id"], a["id"], b["id"]]}, headers=h)).json()["data"]
    assert [x["title"] for x in r] == ["C", "A", "B"]
    assert (await api.post(f"{BASE}/reorder", json={"ids": [c["id"], a["id"]]}, headers=h)).status_code == 422
    d = (await api.patch(f"{BASE}/{a['id']}", json={"title": "Công việc", "description": "Từ vựng đi làm", "emoji": "💼"}, headers=h)).json()["data"]
    assert (d["title"], d["description"], d["emoji"]) == ("Công việc", "Từ vựng đi làm", "💼")
    await db["vocab_sets"].insert_many([{"owner_id": str((await db["users"].find_one({}))["_id"]), "title": f"x{i}", "groups": [], "status": "draft", "position": 99 + i,
                                         "created_at": d["created_at"], "updated_at": d["created_at"]} for i in range(47)])
    assert (await api.post(BASE, json={"title": "one too many"}, headers=h)).status_code == 409           # 50 sets per user


async def test_learning_progress_and_xp_on_custom_cards(api, db):
    ha, hb = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby")
    s = await make_set(api, ha)
    g1, g2 = await add_group(api, ha, s["id"], "A"), await add_group(api, ha, s["id"], "B")
    c1, c2, c3, c4 = (await add_cards(api, ha, s["id"], g1, ["w1", "w2", "w3"])) + (await add_cards(api, ha, s["id"], g2, ["w4"]))
    await api.post(f"{BASE}/{s['id']}/publish", json={"confirm": True}, headers=ha)
    url = f"{BASE}/{s['id']}/study/answer"
    r = (await api.post(url, json={"card_id": c1["id"], "correct": True}, headers=hb)).json()["data"]
    assert r["newly_learned"] and r["xp_awarded"] > 0
    again = (await api.post(url, json={"card_id": c1["id"], "correct": True}, headers=hb)).json()["data"]
    assert not again["newly_learned"] and again["xp_awarded"] == 0                                       # XP only the first time
    assert not (await api.post(url, json={"card_id": c2["id"], "correct": False}, headers=hb)).json()["data"]["newly_learned"]
    await api.post(url, json={"card_id": c4["id"], "correct": True}, headers=hb)
    assert (await api.get(f"{BASE}/{s['id']}/study/progress", headers=hb)).json()["data"] == {g1: 1, g2: 1}
    assert (await api.get(f"{BASE}/{s['id']}/study/learned?group={g1}", headers=hb)).json()["data"] == [c1["id"]]
    assert (await api.get(f"{BASE}/{s['id']}/study/progress", headers=ha)).json()["data"] == {}          # progress is personal
    other = await make_set(api, ha, "Other")
    assert (await api.post(f"{BASE}/{other['id']}/study/answer", json={"card_id": c1["id"], "correct": True}, headers=ha)).status_code == 404  # card of another set
    await api.patch(f"{BASE}/{s['id']}/cards/{c1['id']}", json={"group_id": g2}, headers=ha)             # moving a card keeps the learner's progress
    assert (await api.get(f"{BASE}/{s['id']}/study/progress", headers=hb)).json()["data"] == {g2: 2}
