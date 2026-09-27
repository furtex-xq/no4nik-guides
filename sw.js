/**
 * Гайд без интернета.
 *
 * Покупатель открывает свою ссылку один раз — дальше страница и её картинки
 * лежат в браузере, и гайд открывается в метро, в дороге и на даче, где связи
 * нет. Это единственная задача этого файла: никаких уведомлений, фоновых
 * синхронизаций и прочего, чем обычно обрастают service worker'ы.
 *
 * Что как кэшируется:
 *
 *   страница        сначала сеть, при отказе — сохранённая копия. Иначе после
 *                   обновления витрины человек неделями видел бы старую.
 *   гайды, картинки отдаём из кэша сразу, а копию в это же время тихо
 *                   обновляем: так страница открывается мгновенно, но правки
 *                   в гайде доезжают со следующего захода.
 *
 * Версия подставляется сборкой. Меняется она — старый кэш стирается целиком.
 */
var ВЕРСИЯ = "b8eb9a01cbd2";
var КЭШ = "no4nik-" + ВЕРСИЯ;

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (имена) {
        return Promise.all(
          имена.map(function (имя) {
            return имя === КЭШ ? null : caches.delete(имя);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

/** Страница: сеть главнее, кэш — страховка. */
function страница(запрос) {
  return fetch(запрос)
    .then(function (ответ) {
      if (ответ && ответ.ok) {
        var копия = ответ.clone();
        caches.open(КЭШ).then(function (c) {
          c.put("index.html", копия);
        });
      }
      return ответ;
    })
    .catch(function () {
      return caches.match("index.html").then(function (c) {
        return c || Response.error();
      });
    });
}

/** Файл: кэш главнее, обновление — в фоне. */
function файл(запрос) {
  return caches.match(запрос).then(function (сохранённое) {
    var свежее = fetch(запрос)
      .then(function (ответ) {
        if (ответ && ответ.ok) {
          var копия = ответ.clone();
          caches.open(КЭШ).then(function (c) {
            c.put(запрос, копия);
          });
        }
        return ответ;
      })
      .catch(function () {
        return сохранённое || Response.error();
      });
    return сохранённое || свежее;
  });
}

self.addEventListener("fetch", function (e) {
  var запрос = e.request;
  if (запрос.method !== "GET") return;
  // чужие адреса не трогаем вовсе: кэшировать чужое мы не вправе
  if (new URL(запрос.url).origin !== self.location.origin) return;
  e.respondWith(запрос.mode === "navigate" ? страница(запрос) : файл(запрос));
});
