# Yayınlama — GitHub Pages + Porkbun

Site tamamen statiktir (sunucu gerekmez), bu yüzden GitHub Pages'te olduğu gibi
çalışır. Aşağıdaki adımlar bir kez yapılır; sonrasında her `git push` siteyi
otomatik günceller.

- **Depo:** `github.com/melihcc/dorukinsaatavcilar`
- **Alan adı:** `dorukinsaatavcilar.com`
- **Firebase projesi:** `doruk-insaat-site`

---

## 1. Değişiklikleri GitHub'a gönderin

```
git push origin main
```

> Depo **herkese açık (public)** olmalı. Özel depolarda GitHub Pages yalnızca
> ücretli planlarda çalışır. Sitede gizli bilgi yok: Firebase web `apiKey`'i
> gizli bir anahtar değildir, güvenlik `firestore.rules` ile sağlanır.

## 2. GitHub Pages'i açın

1. Depo → **Settings** → sol menüden **Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main`, klasör: `/ (root)` → **Save**

Depoda hazır bekleyen dosyalar bu adımı destekler:

| Dosya | Görevi |
|---|---|
| `CNAME` | Özel alan adını GitHub'a bildirir |
| `.nojekyll` | Jekyll işlemesini kapatır, dosyalar olduğu gibi sunulur |
| `404.html` | Olmayan adreslerde site tasarımıyla uyumlu hata sayfası |

İlk yayın 1–2 dakika sürer. Bu aşamada site
`melihcc.github.io/dorukinsaatavcilar` adresinde görünür.

> Bu geçici adreste **404 sayfasının bağlantıları çalışmaz** — o sayfa kök
> dizinden sunulmak üzere yazıldı. Alan adı bağlandığında düzelir, endişe etmeyin.

## 3. Porkbun'da DNS kayıtlarını girin

Porkbun → **Domain Management** → `dorukinsaatavcilar.com` → **DNS**

Varsa Porkbun'un eklediği hazır "parking" A/ALIAS kayıtlarını **silin**, sonra
şunları ekleyin:

**Kök alan adı için (dorukinsaatavcilar.com) — dört A kaydı:**

| Type | Host | Answer |
|---|---|---|
| A | (boş bırakın) | `185.199.108.153` |
| A | (boş bırakın) | `185.199.109.153` |
| A | (boş bırakın) | `185.199.110.153` |
| A | (boş bırakın) | `185.199.111.153` |

**www için — bir CNAME kaydı:**

| Type | Host | Answer |
|---|---|---|
| CNAME | `www` | `melihcc.github.io` |

> **Bu IP adreslerini girmeden önce doğrulayın.** GitHub bunları yıllardır
> değiştirmedi ama yanlış IP siteyi tamamen erişilemez yapar. Güncel liste:
> <https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>
>
> Alternatif: Porkbun ALIAS kaydını destekler. Dört A kaydı yerine tek bir
> `ALIAS` / host boş / cevap `melihcc.github.io` kaydı da olur; GitHub IP
> değiştirirse kendiliğinden uyum sağlar.

DNS'in yayılması genelde 10–30 dakika, bazen birkaç saat sürer.

## 4. HTTPS'i zorunlu kılın

DNS yayıldıktan sonra Settings → Pages ekranına dönün:

1. **Custom domain** alanında `dorukinsaatavcilar.com` yazıyor olmalı
   (CNAME dosyası sayesinde kendiliğinden gelir)
2. GitHub sertifikayı hazırlayınca **Enforce HTTPS** kutusu tıklanabilir olur →
   işaretleyin

> "Certificate not yet created" yazıyorsa DNS henüz yayılmamıştır; bir saat
> sonra tekrar bakın.

---

## 5. Firebase ve Cloudflare tarafı — atlanırsa form ve panel çalışmaz

### 5a. Firebase yetkili alan adları

Bu adım atlanırsa **yönetim paneline giriş yapılamaz.**

[Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/doruk-insaat-site/authentication/settings)
→ **Add domain** → `dorukinsaatavcilar.com`
→ tekrar **Add domain** → `www.dorukinsaatavcilar.com`

### 5b. Cloudflare Turnstile alan adı

Bu adım atlanırsa **teklif ve iletişim formları gönderilemez** — güvenlik
doğrulaması alan adını tanımadığı için hata verir.

[Cloudflare Dashboard](https://dash.cloudflare.com/) → **Turnstile** →
`0x4AAAAAACrse96TeUJY_VGZ` anahtarına ait widget → **Settings** → Hostnames
listesine `dorukinsaatavcilar.com` ve `www.dorukinsaatavcilar.com` ekleyin.

### 5c. Firestore güvenlik kuralları — **hâlâ bekliyor**

`firestore.rules` dosyasındaki `/mail` kuralı güncellendi ama henüz
yayınlanmadı. Yayınlanana kadar herkes sizin Firebase projenizden istediği
adrese e-posta attırabilir.

[Firestore → Rules](https://console.firebase.google.com/project/doruk-insaat-site/firestore/rules)
→ `firestore.rules` içeriğini yapıştırın → **Publish**

Aynı şekilde `storage.rules` için:
[Storage → Rules](https://console.firebase.google.com/project/doruk-insaat-site/storage)

---

## 6. Yayın sonrası kontrol listesi

Site açıldıktan sonra sırayla deneyin:

- [ ] `https://dorukinsaatavcilar.com` açılıyor ve kilit simgesi yeşil
- [ ] `https://www.dorukinsaatavcilar.com` köke yönleniyor
- [ ] Menüdeki beş sayfa da açılıyor
- [ ] Olmayan bir adres (`/deneme`) 404 sayfasını gösteriyor ve bağlantıları çalışıyor
- [ ] Tema düğmesi çalışıyor, sayfa yenilendiğinde seçim korunuyor
- [ ] Teklif formu gönderiliyor ve panelde görünüyor *(5b yapılmadan çalışmaz)*
- [ ] `/admin/` adresine giriş yapılabiliyor *(5a yapılmadan çalışmaz)*
- [ ] `https://dorukinsaatavcilar.com/sitemap.xml` açılıyor

## 7. Google'a bildirin

[Search Console](https://search.google.com/search-console) → **Add property** →
`https://dorukinsaatavcilar.com` → doğrulama için **DNS kaydı** yöntemini seçin
(Porkbun'da TXT kaydı olarak eklersiniz) → sonra **Sitemaps** bölümüne
`sitemap.xml` girin.

---

## Sonraki güncellemeler

Site içeriğinin çoğu **yönetim panelinden** değiştirilir ve anında yayına girer;
GitHub'a dokunmanız gerekmez (bkz. `ADMIN-KURULUM.md`).

HTML/CSS/JS dosyalarında bir değişiklik yaptığınızda ise:

```
git add -A && git commit -m "değişiklik açıklaması" && git push
```

Push'tan 1–2 dakika sonra site güncellenir. Tarayıcı eski sürümü gösteriyorsa
Ctrl+F5 (Mac'te Cmd+Shift+R) ile önbelleği atlatın.

### Alan adı değişirse

Şu üç yeri birlikte güncelleyin, yoksa arama motoru yanlış adresi kaydeder:

1. `CNAME` dosyası
2. `js/site-config.js` içindeki `SITE_ORIGIN`
3. `sitemap.xml` ve `robots.txt` içindeki adresler
4. Sayfalardaki `canonical` ve `og:url` etiketleri
