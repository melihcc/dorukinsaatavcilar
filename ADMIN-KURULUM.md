# Yönetim Paneli — Kurulum

Panel `/admin/` adresinde çalışır. Çalışmaya başlaması için Firebase tarafında
**üç** ayar yapılması gerekir. Hepsi tek seferliktir, yaklaşık 10 dakika sürer.

Firebase projesi: **doruk-insaat-site**

---

## 1. Yönetici hesabını oluşturun

1. [Firebase Console](https://console.firebase.google.com/project/doruk-insaat-site/authentication/providers) → **Authentication**
2. **Sign-in method** sekmesi → **Email/Password** → **Enable** → **Save**
3. **Users** sekmesi → **Add user**
   - E-posta ve şifre girin (bu bilgilerle panele gireceksiniz)
   - **Add user**
4. Oluşan kullanıcının satırındaki **User UID** değerini kopyalayın.

> UID'yi kaçırdıysanız sorun değil: panele giriş yaptığınızda ekranda
> "Bu hesabın yönetim yetkisi yok" yazısıyla birlikte UID gösterilir ve
> tek tıkla kopyalanır.

## 2. Hesabı yönetici listesine ekleyin

1. [Firestore Database](https://console.firebase.google.com/project/doruk-insaat-site/firestore) → **Data**
2. **Start collection** → koleksiyon kimliği: `admins`
3. **Document ID** alanına **1. adımdaki UID**'yi yapıştırın
4. Bir alan ekleyin: `email` (string) → yönetici e-postası
5. **Save**

Sonradan başka bir yönetici eklemek için: Authentication'da yeni kullanıcı
oluşturun, UID'sini `admins` koleksiyonuna yeni bir belge olarak ekleyin.
Yetkiyi kaldırmak için o belgeyi silmek yeterlidir.

## 3. Güvenlik kurallarını yayınlayın

Bu adım atlanırsa panel veri okuyamaz/yazamaz ve site içerikleri güncellenmez.

> **⚠ Kurallar güncellendi — yeniden yayınlamanız gerekiyor.**
> `mail` koleksiyonunun eski kuralı, alıcı adresini sınırlamadığı için
> herkesin sizin Firebase projenizden istediği adrese e-posta attırmasına
> izin veriyordu. Yeni kural alıcıyı `dorukemlakgayrimenkul@gmail.com`
> adresinde sabitler. Bu kural yayınlanana dek açık kapı durur —
> lütfen aşağıdaki adımı ilk fırsatta uygulayın.
>
> Bildirim adresini ileride değiştirirseniz **iki yeri birlikte** güncelleyin:
> `firestore.rules` içindeki adres ve `js/site-config.js` içindeki
> `MAIL_ALICI`. Yalnızca birini değiştirirseniz form bildirimleri gitmez.

**Firestore:**
1. Firestore Database → **Rules**
2. `website/firestore.rules` dosyasının içeriğini yapıştırın → **Publish**

**Storage:**
1. [Storage](https://console.firebase.google.com/project/doruk-insaat-site/storage) → **Rules**
   (Storage ilk kez kullanılıyorsa önce **Get started** ile etkinleştirin)
2. `website/storage.rules` dosyasının içeriğini yapıştırın → **Publish**

## 4. Yayınlanan alan adını yetkilendirin

Authentication → **Settings** → **Authorized domains** listesinde sitenizin
alan adı yoksa **Add domain** ile ekleyin. (`localhost` zaten ekli gelir.)

---

## Panelin kullanımı

`https://ALAN-ADINIZ.com/admin/` adresine gidip e-posta ve şifrenizle girin.

### Genel Bilgiler
Telefon, e-posta, adres, Google Haritalar bağlantısı, çalışma saatleri ve
sosyal medya hesapları. Buradaki değişiklikler **tüm sayfaların** alt bilgi ve
iletişim bölümlerinde anında görünür.

Boş bıraktığınız sosyal medya hesaplarının ikonu sitede hiç görünmez. Hiçbirini
doldurmazsanız "Sosyal Medya" başlığı da görünmez.

**Telefon alanı boşken telefon satırı sitede hiç görünmez.** Bu bilinçli bir
tercihtir: ziyaretçiye çalışmayan bir numara göstermektense hiç göstermemek
yeğdir. Numarayı buraya girdiğiniz anda tüm sayfalarda belirir.

**Alt Bilgi Metni**, tüm sayfaların alt bilgisinde logonun altındaki tanıtım
yazısıdır. Boş bırakırsanız şablondaki metin kalır.

Google Haritalar bağlantısı için: Haritalar'da firmanızı bulun →
**Paylaş** → **Bağlantıyı kopyala** → panele yapıştırın.

### Sayfa İçerikleri
Üstten bir sayfa seçin. Sayfadaki başlıklar, yazılar ve görseller bölüm bölüm
listelenir. Değiştirmek istediğinizi düzenleyip **Değişiklikleri Kaydet** deyin.

- Değiştirdiğiniz alanlarda **değiştirildi** etiketi çıkar.
- **sitedekine döndür** bağlantısı, o alanı özgün hâline geri alır.
- Görsellerde **Değiştir** düğmesiyle bilgisayarınızdan yeni fotoğraf yükleyin
  (en fazla 8 MB, JPG/PNG/WebP).

### Projeler
Proje ekleyin, düzenleyin, silin; okla yukarı/aşağı taşıyarak sitedeki sırayı
belirleyin.

- **Adres eki**: projenin bağlantısında görünen kısım
  (`projelerdetay.html?proje=avcilar-sahil-konaklari`). Boş bırakırsanız proje
  adından otomatik üretilir. Proje yayına girdikten sonra değiştirmeyin —
  eski bağlantılar çalışmaya devam eder ama arama motorundaki sırası sıfırlanır.
- **Ana sayfada öne çıkar**: ana sayfadaki üç projelik bölümde görünür.
- **Sitede yayında**: kapatırsanız proje siteden kalkar ama silinmez.
- Kapak görseli, galeri, künye, özellikler ve konum bilgileri proje detay
  sayfasını otomatik oluşturur.
- **Henüz hiç proje eklenmemişken sitede şablonla gelen örnek projeler görünür.**
  İlk projeyi kaydettiğiniz anda örnekler yerlerini gerçek projelere bırakır.

### Teklif Talepleri
Siteden gelen form gönderimleri, en yenisi üstte. Telefon ve e-postaya
tıklayarak doğrudan arama/yanıt yapabilirsiniz. Sağ üstteki çöp kutusu
simgesiyle bir talebi kalıcı olarak silebilirsiniz (onay sorar).

---

## Teknik notlar

- **Sitenin HTML'i değiştirilmez.** Panelde yaptığınız düzenlemeler
  Firestore'da saklanır ve sayfa açılırken uygulanır. Firestore'a
  erişilemezse sayfa şablondaki özgün içeriğiyle çalışmaya devam eder —
  yani panel çökse bile site ayakta kalır.
- Metin ve görseller, HTML'deki özgün içeriklerinden türetilen kalıcı
  anahtarlarla eşleşir. Sayfadaki bölümlerin yeri değişse bile
  kayıtlı içerikler doğru yerde kalır.
- Bir sayfanın HTML'inde bir metnin **özgün hâli** elle değiştirilirse, o alana
  ait kayıt eşleşmeyi kaybeder ve alan panelde yeni/boş görünür. Bu durumda
  düzenlemeyi panelden tekrar yapmanız yeterlidir.
- Yüklenen görseller Storage'da `site/` klasöründe saklanır. Şablonla gelen
  örnek görseller ise `assets/img/` klasöründe, sitenin kendi içinde durur.
- **Ziyaretçi aydınlık/karanlık tema arasında geçiş yapabilir** (üst çubuktaki
  güneş/ay düğmesi). Seçim tarayıcıda saklanır; hiç seçim yapılmamışsa
  işletim sisteminin tercihi kullanılır.
- Alan adı, form bildirimlerinin gideceği e-posta ve paylaşım görseli
  `js/site-config.js` dosyasında tek yerde tutulur.

### Firestore veri yapısı

| Yol | İçerik |
|---|---|
| `site/settings` | İletişim bilgileri ve sosyal medya |
| `content/{sayfa}` | Sayfaya ait metin/görsel değişiklikleri |
| `projects/{id}` | Projeler |
| `teklifler/{id}` | Form gönderimleri |
| `admins/{uid}` | Yönetici listesi |
| `mail/{id}` | Trigger Email eklentisinin kuyruğu |

### Dosyalar

| Dosya | Görevi |
|---|---|
| `admin/index.html`, `admin/js/admin.js` | Yönetim paneli |
| `js/firebase.js` | Firebase bağlantısı (db, auth, storage) |
| `js/cms-keys.js` | Düzenlenebilir alanların keşfi — panel ve site ortak kullanır |
| `js/content.js` | Kayıtlı içerikleri siteye uygular |
| `js/projects.js` | Proje listeleri ve proje detay sayfası |
| `js/site.js` | Mobil menü, tema değiştirme, telif yılı |
| `js/site-config.js` | Alan adı, bildirim e-postası gibi sabitler |
| `sitemap.xml`, `robots.txt` | Arama motoru yönlendirmeleri |
| `firestore.rules`, `storage.rules` | Güvenlik kuralları |
