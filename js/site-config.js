/* Doruk İnşaat — tek noktadan yapılandırma
 *
 * Sitenin birden fazla dosyasında geçen sabitler burada toplanır ki
 * değişiklik gerektiğinde tek yer güncellensin.
 */

/** Yayındaki alan adı — canonical, og:url ve sitemap.xml bunu kullanır. */
export const SITE_ORIGIN = "https://dorukinsaatavcilar.com";

/** Form bildirimlerinin gideceği adres.
 *  DİKKAT: firestore.rules içindeki /mail kuralı bu adresi sabitler.
 *  Burayı değiştirirseniz kuralı da güncelleyip yeniden yayınlayın. */
export const MAIL_ALICI = "dorukemlakgayrimenkul@gmail.com";

/** Sosyal paylaşım görseli (mutlak URL olmak zorundadır). */
export const OG_IMAGE = SITE_ORIGIN + "/assets/logo.png";
