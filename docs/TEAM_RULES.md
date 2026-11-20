# Team Rules: Git Workflow & Working Agreement

> Detailed merge procedure and conflict fixes: [`MERGE_GUIDE.md`](MERGE_GUIDE.md)

## Branches
| Branch | Purpose |
|---|---|
| `main` | Always runs and is always demo-able. **No direct commits.** Changes land by PR/merge only. |
| `feature/mustafa`, `feature/faheem`, `feature/mujeeb`, `feature/tauheed` | One per member, each tied to one module |
| `contracts/<topic>` | Short-lived branch for an agreed change to `/contracts` |

`dev` is not used. Integrate straight into `main` to keep things simple.

## Starting (once, after this skeleton is on `main`)
```bash
git fetch origin
git checkout feature/<your-name>
git reset --hard origin/main        # only now, while your branch has no work
git push --force origin feature/<your-name>
```

## Daily loop
```bash
# 1. Work and commit small, often
git add <your folder>
git commit -m "collector: add JWT redaction rule"

# 2. Stay in sync with main (at least every 2–3 hours)
git fetch origin
git merge origin/main

# 3. Push your branch
git push origin feature/<your-name>
```

## Merging into main (every 3–4 hours, or at each checkpoint)
1. `git merge origin/main` into your branch first and fix any conflicts **on your branch**.
2. Make sure `./scripts/dev.sh` still starts everything and `python contracts/validate.py` passes.
3. Open a PR `feature/<name>` → `main`. Someone else glances at it (2 minutes, not a full review).
4. Merge. Post "merged X" in the team chat. Everyone pulls `main`.

## Ownership: edit only your folders
| Module | Folders | Owner |
|---|---|---|
| Person A: Collector & Privacy | `collector/` | _fill in_ |
| Person B: Transport, Reliability & Ingest | `transport/`, `saas/ingest/`, `saas/db.py`, `saas/config.py` | _fill in_ |
| Person C: AIOps Engine | `saas/aiops/` | _fill in_ |
| Person D: Dashboard, Demo & Docs | `dashboard/`, `demo/`, `docs/` | _fill in_ |
| Shared | `contracts/`, `saas/app.py`, `scripts/`, root files | **All**, by agreement only |

Need something changed in someone else's folder? Ask them, or open an issue. Don't edit it yourself.

## Commit messages
`<module>: <what changed>`, e.g. `aiops: add EWMA baseline`, `dashboard: egress proof panel`.

## Never commit
- `.env` or any real secret/key (use `.env.example`)
- `node_modules/`, `.next/`, `.venv/`, `__pycache__/`
- `*.db` files or `collector/data/`, `saas/data/`

## Checkpoints (map to judging phases)
| When | Must be on `main` |
|---|---|
| Phase 1 | `docs/ARCHITECTURE.md` trust-boundary sketch, allow-list, feature priority, roles |
| Phase 2 | Architecture diagram with hops, payload schema, failure plan, tenant isolation |
| Integration #1 (≈ hour 8) | Raw record → redacted payload → SaaS → visible on dashboard |
| Phase 3 | Buffering, egress panel, 4 health states, anomaly alerts, measured latency |
| Feature freeze (end − 4 h) | Only bug fixes after this. Rehearse all 8 scenarios. |
| Phase 4 | Demo |

## If something breaks main
Whoever merged it fixes it **immediately**, or reverts it with `git revert <sha>`. Nobody builds on a broken `main`.
