# Vini ♡ Line

Um jogo mobile-first, estático e instalável: Vini lança corações e Line os recolhe em uma cesta que enche e transborda.

## Testar

Sirva a pasta por HTTP (o service worker não funciona via `file://`):

```bash
python3 -m http.server 8080
```

Abra `http://localhost:8080`. Arraste/toque para mover a cesta; no desktop, use o mouse. O progresso fica em `localStorage`.

## Estrutura

- `index.html`: canvas, abertura e HUD acessível.
- `style.css`: layout mobile, abertura e acabamento da interface.
- `game.js`: desenho, física, controles, progressão, áudio e persistência.
- `manifest.json` e `service-worker.js`: instalação e cache offline.
- `assets/`: ícone e futuros arquivos de arte ou áudio.

## Publicar

Publique a raiz como site estático (sem comando de build). Em Render, escolha **Static Site**, deixe o build vazio e use `.` como diretório de publicação. HTTPS é necessário para instalação PWA fora de `localhost`.

Para trocar ou adicionar arte/áudio no futuro, coloque os arquivos em `assets/`, referencie-os em `game.js` e inclua-os na lista `FILES` do service worker.
