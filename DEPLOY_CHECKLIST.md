# Чеклист перед реальным тестом (Молдова ↔ РФ)

## 0. Порядок работ (приоритет)

**До теста с подругой:**

1. **Логи `[sync]/[buffer]/[socket]`** (раздел 3) — без них тест бесполезен, не узнаешь причину дрейфа.
2. **Cron-пинг `/health` раз в 10 мин** (раздел 4) — чтобы Free tier не засыпал и подруга не ждала 30с холодный старт.
3. **Graceful shutdown** (раздел 4) — broadcast `server:restart` перед закрытием сокетов, иначе при рестарте Render клиенты молча отваливаются.
4. **Debounce `buffer:state` 500ms** (раздел 1) — чтобы флип `waiting/playing` на дёрганом мобильном не съел rate limit.

**— ТЕСТ —**

5–7. **Тюнинг порогов** (раздел 1: `MAX_EVENTS_PER_SEC`, sync thresholds, NTP 20 замеров) — только по цифрам из реальных логов, до теста это гадание.

**Backlog (не блокеры):**

8+. Раздел 6 — host migration, persist комнат, touch-жесты, адаптивное качество HLS.

## 1. Параметры, которые стоит подкрутить

### Сервер — `shared/constants.ts`

- [ ] `MAX_EVENTS_PER_SEC`: **20 → 50**
  Причина: socket.io при reconnect может выплеснуть буфер пачкой, легитимные пакеты улетят в drop.
- [ ] Либо: отдельный whitelist без лимита для `sync:packet` и `time:ping`, а лимит 20 оставить для chat/room.

### Sync thresholds — `client/src/sync/sync-manager.ts`

- [ ] Порог жёсткого seek при `play`: **1s → 2s**
  Причина: при RTT 300ms+ разница легко >1s из-за задержки пакета + local drift, каждое нажатие будет дёргать seek.
- [ ] Порог выравнивания при `pause`: **50ms → 100ms**
  Причина: на реальной сети 50ms ловится сетевым джиттером.

### Remote action window — `sync-manager.ts`

- [ ] Увеличить `windowMs`: **300 → 500**
  Причина: `seeked` event после `currentTime =` может прийти с задержкой на медленной машине/телефоне.

### Buffering — `client/src/components/Player.tsx`

- [ ] Debounce для `buffer:state`: отправлять не чаще 1 раза в 500ms
  Причина: на дёрганом соединении `waiting`/`playing` могут чередоваться по 5 раз в секунду.

### NTP — `client/src/sync/time-sync.ts`

- [ ] Проверить: периодическая пересинхронизация раз в 60с (должна быть)
- [ ] При RTT > 300ms — делать не 10 замеров, а 20 (больше данных для усреднения)

## 2. HLS proxy

- [ ] **Переехать прокси на отдельный поддомен/сервер**, если клиенты географически далеко — или
- [ ] Использовать cloudflare/подобный CDN перед прокси — или
- [ ] Дать клиентам прямую ссылку без прокси, если CORS позволяет (не всегда)

**Сейчас:** весь видеотрафик идёт `CDN → твой сервер → клиент`. На HD-фильме это 2-5 Mbps × 2 юзера = 4-10 Mbps через твой сервер.

## 3. Мониторинг — что логировать во время теста

### На клиенте (console.log с префиксом `[sync]`)

- [ ] Offset от NTP каждые 60с: `[sync] offset=123ms rtt=150ms`
- [ ] Drift при каждом sync-пакете: `[sync] drift=+250ms target=1234.56 current=1234.81`
- [ ] Каждое remote action: `[sync] remote play at 1234.56`
- [ ] Каждое local action: `[sync] local pause at 1234.78`
- [ ] Buffering events: `[buffer] waiting/playing`
- [ ] Reconnect: `[socket] disconnected → reconnecting (attempt N)`

### На сервере

- [ ] Rate limit hits: `[ratelimit] socket=xxx blocked event=xxx`
- [ ] Proxy 4xx/5xx: `[proxy] 401 for https://...`
- [ ] Комнаты: create/join/leave с таймстампом

## 4. Deploy-готовность

**Выбранная архитектура:** один Render Web Service (Free) — Fastify отдаёт и WS, и собранный `client/dist`. Клиент и сервер на одном origin.

### Сделано
- [x] `.env.production` для клиента: `VITE_SERVER_URL=` (пусто → same-origin)
- [x] CORS: `CLIENT_ORIGIN` env, в prod дефолт `true` (same-origin всё равно)
- [x] HTTPS/WSS — Render даёт автоматически
- [x] Auto-restart — встроено в Render
- [x] Статика SPA: `@fastify/static` + `setNotFoundHandler` → `index.html` для любого GET кроме `/api/*` и `/socket.io/*`
- [x] Сборка сервера через `tsup` (инлайнит workspace `shared`, один `dist/index.mjs`)
- [x] `render.yaml` blueprint — `buildCommand: npm install --include=dev && npm run build` (без `--include=dev` vite/tailwind не ставятся при `NODE_ENV=production`)
- [x] Node 20 зафиксирован в `engines` + `.node-version`

### Осталось
- [ ] Graceful shutdown: `SIGTERM` → broadcast `server:restart` → `io.close()` → `app.close()`
  Причина: Render перезапускает инстанс при деплое/засыпании. Сейчас комнаты просто пропадают без уведомления клиента.
- [ ] Разбудить сервис перед просмотром: Free tier засыпает после 15 мин без трафика, холодный старт ~30с. Либо cron-пинг `/health` раз в 10 мин (например, cron-job.org), либо просто открыть ссылку за минуту до.
- [ ] Лимиты Free tier: 512MB RAM / 0.1 CPU / ~100GB трафика в месяц. Фильм 1.5ч ≈ 2GB × 2 юзера = 4GB. Хватит на ~25 просмотров.
- [ ] Мониторинг трафика в Render dashboard — если упрёмся, выносить HLS-прокси отдельно.

### Known gotchas от реального деплоя
- `tsc` через rootDir не собирает workspace `shared` — пришлось перейти на `tsup` с `noExternal: ['shared']`
- `import.meta.env` в клиенте требует `"types": ["vite/client"]` в tsconfig
- Render по умолчанию скипает devDependencies → нужен `--include=dev` в buildCommand

## 5. Сценарий тестирования с подругой

**Цель: 30 минут непрерывного просмотра без ручного вмешательства.**

1. [x] ~~Задеплоить на VPS (DigitalOcean/Hetzner — от $5/мес)~~ → Render Free tier
2. [ ] Открыть две вкладки с разных сетей (твой 4G + её WiFi)
3. [ ] Включить фильм, оставить на 5 минут — замерить drift (должен быть <100ms)
4. [ ] Перемотать 10 раз подряд — проверить, что не залипает
5. [ ] Одновременно нажать pause у обоих (race condition)
6. [ ] Выключить Wi-Fi у одного на 10 секунд → включить → должен догнать
7. [ ] Закрыть вкладку → открыть снова с тем же кодом → должен войти в ту же комнату
8. [ ] Фильм 1.5 часа до конца — smoke-тест на утечки памяти

## 6. Известные риски, которые не закрыты

- **Host migration не реализован** — если хост (тот, кто создал комнату) уходит, комната не переназначает хоста. Второй юзер остаётся, но периодический sync от хоста не приходит → drift correction не работает.
- **Нет сохранения состояния комнаты** — если сервер перезапустится, все комнаты очистятся.
- **Нет адаптивного качества HLS** — HLS.js выбирает дорожку автоматически, но между клиентами могут быть разные качества → разный размер сегментов → разная буферизация.
- **Нет `touch`-жестов** на мобильных — перемотка свайпом не работает.
