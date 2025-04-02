# vibeTV - IPTV Player

Простой IPTV плеер с поддержкой протоколов HLS, построенный на Next.js.

## Функциональность

- Загрузка и парсинг M3U плейлистов
- Поиск каналов
- Воспроизведение видеопотоков с поддержкой HLS
- Адаптивный дизайн

## Технологии

- Next.js 15
- React 19
- HLS.js для поддержки потокового видео
- TailwindCSS для стилизации

## Установка и запуск

1. Клонировать репозиторий
```bash
git clone https://github.com/otakukz17/vibeTV.git
cd vibeTV
```

2. Установить зависимости
```bash
npm install
```

3. Запустить в режиме разработки
```bash
npm run dev
```

4. Создать продакшн-сборку
```bash
npm run build
```

## Деплой на GitHub Pages

Этот проект настроен для автоматического деплоя на GitHub Pages через GitHub Actions.

### Шаги для настройки:

1. Создайте репозиторий на GitHub
2. Включите GitHub Pages в настройках репозитория
   - Перейдите в Settings -> Pages
   - В разделе "Source" выберите "GitHub Actions"
3. Отредактируйте файл `next.config.ts`, если размещаете на GitHub Pages:
   - Укажите строку `basePath` с названием вашего репозитория
4. Залейте код в репозиторий:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/otakukz17/vibeTV.git
git push -u origin main
```

После пуша в ветку main GitHub Actions автоматически выполнит сборку и деплой.

## Ограничения

- Браузеры имеют ограничения на форматы потокового видео
- Не все протоколы поддерживаются (RTMP, RTSP могут не работать)
- Некоторые каналы могут блокировать воспроизведение из-за CORS-ограничений
