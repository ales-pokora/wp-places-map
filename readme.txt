=== WP Places Map ===
Contributors: alespokora
Tags: map, google maps, locations, places, custom post type
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.15
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

= 1.0.15 =
* **Klik na Prahu už opravdu vybere Prahu, ne Středočeský.** Středočeský polygon dostal řádný "Praha-shaped" otvor (donut) přes `mapshaper -erase`. Bez otvoru ležel Středočeský geograficky NAD Prahou a Data Layer click hit-test ho dispatchoval místo Prahy.
* **Region badge pro Prahu a Středočeský sedí na svých místech.** Centroid pro count badge se počítá area-weighted shoelace formulí přes všechny prsteny (díry mají záporné znaménko), takže donut Středočeského má centroid přes ~10 km východně od Prahy místo vrch-na-vrch s pražským badge. Předtím `bounds.getCenter()` házel oba na ~(14.47, 50.06) — vizuálně se překrývaly.
* `parseRegionPolygons` teď předává všechny prsteny (outer + holes) do `google.maps.Polygon`, takže `containsLocation` rozpoznává díry. Praha-located zařízení už nemůžou spadnout do Středočeského ani při změně iteračního pořadí.

= 1.0.14 =
* **Praha je opět samostatný kraj.** GeoJSON vrácen ze 13 na 14 features — Praha (CZ010) má svůj polygon a klikací oblast jako kterýkoli jiný kraj. Místa v Praze se klasifikují jako "Hlavní město Praha" (ne Středočeský), region bar nad mapou ukazuje "Kraj: Hlavní město Praha", filter pillky se počítají zvlášť. Středočeský kraj nadále obklopuje Prahu jako geografický prstenec a obsahuje jen středočeská zařízení.

= 1.0.13 =
* Při výběru kraje se clustering vypíná — uvnitř regionu uživatel drillne pro detail, slučování blízkých markerů do "2" bubliny ten detail schovává. Pardubický se tvářil OK, protože jeho 2 místa jsou v různých městech (Chrudim, Pardubice) a neclusterovala se nikdy; Jihočeský s 2 místy ve stejném městě se slučoval, což působilo nekonzistentně.

= 1.0.12 =
* Region badge se nezobrazuje pro aktuálně vybraný kraj — duplikovala se s cluster bublinou v centru regionu. Chip nad mapou + clustery uvnitř kraje signál o aktivním kraji nesou, badge tam přebýval.

= 1.0.11 =
* Defenzivní stub pro `WPPM_onMapsReady` se vloží inline před Maps SDK script tag. Když selže načtení `frontend.js` (typicky kvůli serverovému rate-limitu / WAF 429), Google Maps SDK už nevyhodí `InvalidValueError: WPPM_onMapsReady is not a function` — stub zachytí volání a nastaví flag. Když se `frontend.js` později dotáhne (cache, opakovaný request), přečte flag a replay missed callback. Plugin se tedy v degradovaném prostředí nerozbije s tvrdou chybou.

= 1.0.10 =
* Region badges (bílé kruhy s počtem) se skryjí ve výchozím "Vše" pohledu — bez aktivního filtru je distribuce už čitelná z cluster bublin, badge by jen duplikoval informaci a zaclonil mapu. Objeví se hned jak uživatel klikne na filtr typu, region nebo začne hledat.

= 1.0.9 =
* **Permanentní počty na krajích.** Menší cyan kruhy (38 px, bílá výplň, cyan outline + číslo) sedí v centroidu každého kraje a ukazují počet zařízení v tom kraji. Zůstávají vidět i když je nějaký kraj vybraný a mapa je zazoomovaná — uživatel hned vidí "Pardubický 3, Jihomoravský 7" a může klikem skočit jinam. Aktuálně vybraný kraj má badge vyplněnou cyan jako vizuální signál.
* Počty v badge reflektují aktivní typ + hledání (ale ne region filter), takže při filtrování "Lékárna" je vidět kde jaké lékárny v krajích leží.
* Klik na badge = klik na polygon kraje (sjednoceno do shared `activateRegion()` helperu).

= 1.0.8 =
* **Praha sloučena do Středočeského kraje.** GeoJSON přepočítán z 14 na 13 features geometrickým sjednocením polygonů Praha (CZ010) + Středočeský (CZ020). Místa v Praze se teď klasifikují jako Středočeský kraj, kliknutí na region "Středočeský" zobrazí všechna pražská i středočeská zařízení dohromady.
* Odstraněn overlay "Žádné zařízení v tomto výběru" — ztlumené pillky s 0 počtem dostatečně signalizují prázdný stav, modal byl příliš dominantní.

= 1.0.7 =
* **Filter pillky se přepočítávají dle vybraného kraje** — počet vedle "Lékárna", "Nemocnice" atd. se mění podle aktivního kraje + vyhledávacího dotazu. Typ s 0 výsledky se vizuálně ztlumí + jeho počet zčervená, takže prázdný stav je hned zřejmý (pomáhá rozlišit "Praha vs. Středočeský kraj" — Praha je samostatný NUTS3 region, ne součást Středočeského).
* **Overlay "Žádné zařízení v tomto výběru"** s tlačítkem **Zrušit filtry** se zobrazí, když kombinace typ + kraj + hledání nevrátí žádné markery. Jeden klik vrátí výchozí CZ-wide pohled a vyčistí všechny filtry.

= 1.0.6 =
* Cluster bublina je teď plně plochý cyan kruh — odstraněn radial-gradient highlight uvnitř SVG. Číslo na čistém pozadí, dynamický pulse halo zůstává a teď drží veškerou vizuální energii.

= 1.0.5 =
* **Dynamický pulse halo na clusterech** — místo statického cyan gradientu na okraji clusteru se teď okolo cluster bublin vlní jemné radiální haló. Dva nezávislé sloty: vždy max 2 cluster bubliny pulzují současně, výběr je náhodný, takže záře "skáče" mezi krajem. Animace 2.4 s ease-out, respektuje `prefers-reduced-motion`.
* **Vybraný kraj zůstává zvýrazněný** — když uživatel klikne na kraj, jeho silnější fill + 3px stroke + cyan deep barva přetrvávají i po odjezdu myší. Hover na jiný kraj jeho zvýraznění nepřebije; kliknutí na ×ko chip filtru, nebo druhé kliknutí na stejný kraj, zvýraznění zruší.
* SVG cluster odlehčen — zrušeny statické vnější průhledné prstence, ať dominuje dynamický halo overlay.

= 1.0.4 =
* **Velký „wow" detail jako popup modal** — kliknutí na marker už neotevírá malé InfoWindow, ale plnohodnotný modální dialog vystředěný na obrazovku. Hero gradient (nebo náhledový obrázek pokud je k zařízení nahraný), velký název, typ badge, kraj, popis v citátovém boxu, ikony pro telefon/e-mail/web/otevírací dobu, dvouvrstvé CTA (velké „Navigovat" + sekundární „Zavolat / Napsat / Web"). Backdrop-blur za modálem, scale+fade animace, zavře se ESC, kliknutím mimo, nebo ×.
* **Větší cluster bubliny** — počty zařízení v kraji se teď zobrazují jako výrazné cyan kruhy s glow efektem (60–100 px namísto 44–68 px). Lépe čitelné z dálky, působí jako region-summary badge.
* **Search input ladí s filtry** — vyhledávací pole sedí na stejném řádku jako filtr typu (search vlevo, filtry vpravo). Krátký placeholder „Hledat zařízení…". Force-CSS proti Divi resetům, ať je placeholder vždy vidět.

= 1.0.3 =
* **Fulltextové hledání** nad mapou — diakritiku-insenzitivní substring match přes název, město, ulici, PSČ, typ a popis. Kombinuje se s filtrem typu i filtrem kraje. Pole lze vypnout v nastavení.
* **CZ-wide výchozí pohled** — mapa se už při načtení automaticky nepřibližuje na markery; respektuje konfigurovaný střed (49.7437, 15.3386) a zoom 7. Auto-zoom se použije pouze při kliknutí na kraj.
* **Auto-backfill defaultů** — nové klíče v nastavení (například `show_regions` ve verzi 1.0.2) jsou nyní honorovány na existujících instalacích bez re-aktivace. Fix pro: po updatu z 1.0.1 → 1.0.2 se kraje nezobrazily, protože defaultní `show_regions=1` nebyl aplikován na již existující záznam v `wp_options`.

= 1.0.2 =
* **Interaktivní kraje ČR** — 14 krajů se vykresluje jako prosvítavá vrstva nad mapou (defaultně zapnuto). Najetí myší kraj zvýrazní a ukáže tooltip s názvem a počtem zařízení v něm; kliknutím se mapa přiblíží na kraj a markery se zfiltrují jen na zařízení v něm. Druhý klik / "×" chip filter zruší.
* Filtry typu zařízení a filtr kraje pracují kombinovaně (např. "Praktický lékař" v "Pardubickém kraji").
* Bundlovaná GeoJSON vrstva krajů (40 KB, zjednodušená) — žádné externí volání, žádné CDN.
* V nastavení nová sekce "Kraje ČR" — toggle + barva.
* Shortcode má nový atribut `regions="yes|no"` pro override per stránku.

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
