# MERGE_GUIDE.md: Making Merges Seamless

> Goal: four people commit all day, and every merge into `main` is boring.
> This works because of **folder ownership + pre-wired seams + frequent small merges**.

---

## 1. Why our merges won't conflict
1. **Each person owns separate folders.** Git only conflicts when two branches edit the same lines of the same file.
2. **The seams are pre-wired.** Routers are already included in `collector/app.py` and `saas/app.py`, and the hooks (`transport.submit`, `on_ingest`) already exist. You fill in **your own** files; you never edit someone else's to plug in.
3. **Contracts are frozen-by-agreement.** Everyone codes against `contracts/`, so pieces fit when they meet.

### Who may edit what
| Path | Person A | Person B | Person C | Person D |
|---|:-:|:-:|:-:|:-:|
| `collector/` | ✅ | ❌ | ❌ | ❌ |
| `transport/`, `saas/ingest/`, `saas/db.py`, `saas/config.py` | ❌ | ✅ | ❌ | ❌ |
| `saas/aiops/` | ❌ | ❌ | ✅ | ❌ |
| `dashboard/`, `demo/`, `docs/` | ❌ | ❌ | ❌ | ✅ |
| `docs/members/PERSON_X*.md` (your own guide) | own | own | own | own |
| `contracts/`, `saas/app.py`, `scripts/`, `README.md` | 🤝 | 🤝 | 🤝 | 🤝 |
| `requirements.txt` | ➕ append only | ➕ | ➕ | ➕ |

🤝 = only via a `contracts/<topic>` branch after the team agrees in chat.
➕ = add new lines at the bottom only; never reorder or edit others' lines.

---

## 2. The merge rhythm
```
hour:   0    2    4    6    8    10   12   14   16   18   20   22   24
merge:  ▲         ▲         ▲         ▲         ▲         ▲    ▲
      setup    sync #1   INTEG #1  sync     sync    INTEG #2  FREEZE
```
- **Sync every 2–3 h:** merge `main` INTO your branch, so you stay current.
- **Merge INTO `main` every 3–4 h**, or whenever a checklist item is done and runs.
- Small merges are easy; one giant merge at the end is where teams lose hours.

---

## 3. Daily commands

### Start of each work block
```bash
git checkout feature/<you>
git fetch origin
git merge origin/main          # bring in teammates' merged work
```

### Save work (often, every 30–60 min)
```bash
git add <your folders only>    # e.g. git add collector/   (avoid `git add -A` blindly)
git commit -m "collector: add JWT redaction"
git push origin feature/<you>
```

### Ship to main (the merge checklist)
```bash
git fetch origin
git merge origin/main                                   # 1. get latest main into your branch
.venv/bin/python contracts/validate.py                  # 2. contracts still valid
.venv/bin/python -c "import collector.app, saas.app"    # 3. both apps import
./scripts/dev.sh                                        # 4. everything starts (Ctrl+C after it's up)
git push origin feature/<you>
# 5. Open PR on GitHub: feature/<you> → main, title "<module>: <what>"
# 6. One teammate looks for 2 min: "only touches their folders? runs?" → Approve → Merge
# 7. Post in chat: "merged <what> into main, please pull"
```

**Merge method on GitHub:** use **"Create a merge commit"**. Don't squash or rebase shared branches.

---

## 4. Merge checklist (copy into each PR description)
```
- [ ] Merged latest origin/main into my branch first
- [ ] Only my folders changed (plus append-only requirements.txt)
- [ ] python contracts/validate.py passes
- [ ] ./scripts/dev.sh starts SaaS, collector and dashboard without errors
- [ ] No .env, *.db, node_modules, .venv, secrets committed
- [ ] If I changed behaviour others rely on, I posted it in chat
```

---

## 5. When a conflict does happen
| Conflict in | Do this |
|---|---|
| `requirements.txt` | Keep **both** sides' lines. Remove the `<<<<`, `====`, `>>>>` markers. |
| `dashboard/package.json` / `package-lock.json` | Keep both dependencies in `package.json`, then `cd dashboard && rm package-lock.json && npm install` and commit the new lock |
| `contracts/*` | Stop. Ask the team. Whichever version was agreed in chat wins. |
| Someone else's folder | You shouldn't have edited it. Take **their** version: `git checkout --theirs <file>` (or `--ours`, depending on direction), then message them |
| `saas/app.py` | Keep both lines (usually two `include_router` lines) |

After resolving: `git add <files> && git commit` → re-run the merge checklist.

---

## 6. Changing a contract (the only "shared" change)
1. Post in chat: *"I need field `X` in the payload because Y."* Get 👍 from whoever it affects.
2. `git checkout main && git pull && git checkout -b contracts/add-x`
3. Edit the schema **and** a sample payload, then run `python contracts/validate.py`.
4. PR → `main` → merge → post "contract changed, pull main".
5. Everyone: `git merge origin/main` into their branch.

**Adding an optional field = safe. Renaming/removing = breaks someone. Avoid it.**

---

## 7. Mocks: build without waiting for each other
| You are | Pretend the other side exists by |
|---|---|
| A (collector) | `transport.submit()` stub writes payloads to `collector/data/pending_payloads.jsonl` |
| B (transport/ingest) | Feed `contracts/sample_payloads/*.json` through `submit()`; call ingest with `curl` |
| C (aiops) | Loop `on_ingest("t_acme", json.load(...))` over the sample payloads, with fake timestamps |
| D (dashboard) | Read JSON from `contracts/sample_payloads/` and `contracts/aiops_output.md` into a `mock.ts` |

Swap mocks for the real thing **only after** that piece is merged into `main`.

---

## 8. Golden rules
1. `main` always runs. Break it → fix or `git revert <sha>` within 15 minutes.
2. Never force-push `main`. Never force-push someone else's branch.
3. Never commit secrets. Dev secrets go in `.env`, which is git-ignored.
4. Pull `main` before you start, merge `main` before you ship.
5. Talk before touching anything shared.
6. Feature freeze at **hour 20**: after that, only fixes, merged by D.
