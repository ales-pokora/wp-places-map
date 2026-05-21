=== WP Places Map ===
Contributors: alespokora
Tags: map, google maps, locations, places, custom post type
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Interaktivní Google mapa libovolných míst (pobočky, ordinace, prodejny…) s clusterováním, filtry a detailem v popup okně. Plně univerzální, znovupoužitelný plugin.

== Description ==

Plugin přidává:

* **Vlastní typ příspěvku „Místo"** – plně editovatelné v admin rozhraní (název, popis, adresa, GPS, telefon, e-mail, web, otevírací doba, typ).
* **Hromadný CSV import** – nahrajte stovky míst najednou. Pokud chybí GPS, plugin si je dohledá přes Google Geocoding API.
* **Shortcode `[wp_places_map]`** – vloží mapu kamkoliv (Divi Text/Code modul, Gutenberg, klasický editor, theme šablona).
* **Filtry podle typu** + **clusterování markerů** při oddálení.
* **Detail v info window** po kliknutí na marker (adresa, kontakty, navigace).
* **REST API endpoint** pro vlastní integrace.
* **Automatické aktualizace přes GitHub** – plugin si stahuje nové verze přímo z [github.com/ales-pokora/wp-places-map](https://github.com/ales-pokora/wp-places-map). WP Admin → Pluginy ukazuje update notifikaci jako u běžných pluginů.
* **Plně lokalizováno** (čeština).

== Installation ==

1. Nahrajte složku `wp-places-map` do `/wp-content/plugins/` (nebo nainstalujte ZIP přes **Pluginy → Přidat → Nahrát plugin**).
2. Aktivujte plugin v menu **Pluginy**.
3. Otevřete **Mapa míst → Nastavení** a vložte svůj Google Maps API klíč.
4. Přidávejte místa v **Mapa míst → Přidat místo**, nebo použijte **Mapa míst → Import CSV**.
5. Vložte do stránky shortcode `[wp_places_map]`.

= Získání Google Maps API klíče =

1. Otevřete [Google Cloud Console – Maps Credentials](https://console.cloud.google.com/google/maps-apis/credentials).
2. Vytvořte projekt (pokud ještě nemáte).
3. Povolte API: **Maps JavaScript API** + **Geocoding API**.
4. Vytvořte API key a v "Application restrictions" zvolte **HTTP referrers** → přidejte `https://váš-web.cz/*`.

== Release workflow (pro vývojáře) ==

Plugin používá [`YahnisElsts/plugin-update-checker`](https://github.com/YahnisElsts/plugin-update-checker) napojený na GitHub releases.

Nová verze:

1. Bumpni `Version:` header v `wp-places-map.php` a `Stable tag:` v `readme.txt`.
2. Commit + push do `main`.
3. Tag a release přes GitHub CLI:
   ```
   git tag v1.0.1
   git push --tags
   gh release create v1.0.1 wp-places-map.zip --generate-notes
   ```
   ZIP build:
   ```
   git archive --format=zip --prefix=wp-places-map/ -o wp-places-map.zip HEAD
   ```
4. WP Admin → **Pluginy** zobrazí "Aktualizace dostupná" do 12 hodin (nebo hned po `Zkontrolovat znovu`).

= Privátní repo =

Vygenerujte si Personal Access Token (scope `repo`) na [github.com/settings/tokens](https://github.com/settings/tokens) a vložte ho v **Mapa míst → Nastavení → GitHub token**.

Bezpečnější varianta: definujte konstantu ve `wp-config.php`:

```php
define( 'WPPM_GITHUB_TOKEN', 'ghp_xxxxxxxxxxxx' );
```

== Frequently Asked Questions ==

= Funguje plugin s Divi? =

Ano. Vložte shortcode `[wp_places_map]` do Divi modulu **Text** nebo **Code**.

= Co když má někdo desítky tisíc míst? =

REST endpoint vrací všechna místa najednou s 5-min cache. Pro >5 000 markerů doporučujeme upravit endpoint na omezený výřez podle viewport bounds.

= Lze plugin použít na jiném webu? =

Ano, plugin je plně univerzální. Stačí změnit barvu markeru v **Nastavení** podle vaší značky.

== Changelog ==

= 1.0.1 =
* **Google Places Autocomplete** v editaci místa — typeahead s validovanými adresami z Google databáze. Při výběru se automaticky vyplní ulice / město / PSČ / přesné GPS souřadnice a marker se posadí na exaktní místo. Vyžaduje povolené **Places API** v Google Cloud Console (vedle Maps JS API a Geocoding API).
* Serverový geocoder (fallback "Dohledat GPS z adresy" + CSV import) nově s `components=country:CZ` — striktně jen CZ shody, žádné "Pardubice, France".
* Frontend hardening — `bootInstance` má try/catch wrapper, loading overlay se vždy zhasne i při chybě inicializace Google Maps SDK.
* Loading / empty overlay je nyní semi-transparentní s blurem — mapový podklad prosvítá místo bílé plochy.

= 1.0.0 =
* První vydání. CPT, meta box, CSV import, shortcode, REST API, GitHub auto-update.

== Screenshots ==

1. Mapa s clustery markerů a filtrem podle typu.
2. Detail místa v info window po kliknutí na marker.
3. Admin formulář pro editaci s automatickým geokódováním.
4. Hromadný CSV import.
