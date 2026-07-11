# TicketFlow

**KI-gesteuertes Kanban-Board für automatisierte Softwareentwicklung.**

## Konzept

```
┌─────────┐  ┌──────────────┐  ┌────────────┐  ┌─────┐  ┌──────┐
│ Backlog │→ │  Feasibility │→ │  Progress  │→ │ QA  │→ │ Done │
│  Kunden │  │  Agent prüft │  │  Agent     │  │     │  │ Auto │
│   + DU  │  │  Machbarkeit │  │  entwickelt│  │     │  │ Move │
└─────────┘  └──────────────┘  └────────────┘  └─────┘  └──────┘
```

**Jeder Schritt = ein spezialisierter KI-Agent** mit eigenen Regeln:
- **Feasibility Agent** → Prüft Machbarkeit, verfeinert Plan
- **Development Agent** → Implementiert, committet, testet
- **QA Agent** → Qualitätsprüfung

## Features

- ✅ Drag & Drop Kanban (Backlog → Feasibility → Progress → QA → Done)
- ✅ KI-Agenten: **OpenClaw** oder **Claude Code** (wechselbar pro Ticket)
- ✅ Automatischer Status-Übergang: Development → QA → Done
- ✅ GitHub-Integration (Branch + Commit pro Ticket)
- ✅ Aktivitäts-Log für jedes Ticket
- ✅ Multi-Projekt-Support
- ✅ Rollen: Admin (alles) / Kunden (nur Backlog)
- ✅ SQLite-DB (lokal, einfach)

## Tech Stack

| Schicht      | Technologie                    |
|-------------|-------------------------------|
| Frontend    | Next.js 16 (App Router) + Tailwind |
| State       | Zustand                       |
| Backend     | Next.js API Routes            |
| DB          | SQLite via Prisma 7 + libsql |
| KI-Agenten  | OpenClaw Gateway API / Claude Code CLI |

## Setup

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Datenbank migrieren
npx prisma migrate dev --name init

# 3. Dev Server starten
npm run dev
```

**Öffne:** http://localhost:3456

## Agent-Konfiguration

### OpenClaw (Standard)
`OPENCLAW_GATEWAY_URL` und `OPENCLAW_GATEWAY_TOKEN` in `.env` setzen.

### Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

### REPO_PATH
Damit die Agenten den Code finden:
```bash
REPO_PATH=C:\path\to\your\project
```

## Workflow

1. **Projekt erstellen** → GitHub Repo URL angeben
2. **Ticket erstellen** im Backlog (Titel + Beschreibung + Priorität)
3. **→ Feasibility** ziehen → "Feasibility starten" klicken
4. Agent analysiert Machbarkeit → Ergebnis + verfeinerter Plan
5. **→ Progress** ziehen → "Entwicklung starten" klicken
6. Agent implementiert + committet + testet → automatisch → QA
7. **→ QA** prüfen → "QA starten" klicken
8. Agent prüft Qualität → **→ Done** (automatically)

## Ordnerstruktur

```
src/
├── app/
│   ├── api/
│   │   ├── tickets/        # CRUD für Tickets
│   │   ├── projects/       # CRUD für Projekte
│   │   └── agents/run/     # Agent-Ausführung
│   └── page.tsx            # Dashboard
├── components/
│   ├── kanban/             # Board, Column, Card, DetailPanel
│   ├── Header.tsx
│   └── CreateTicketModal.tsx
├── lib/
│   ├── agents/             # Agent-Adapter + Registry
│   └── prisma.ts           # DB-Client
└── store/
    └── ticket-store.ts     # Zustand State
```
