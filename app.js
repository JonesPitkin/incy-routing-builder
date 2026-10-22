(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const serviceSets = {
    'YouTube':['youtube.com','youtu.be','googlevideo.com','ytimg.com'],
    'Telegram':['telegram.org','t.me','telegram.me','tdesktop.com'],
    'WhatsApp':['whatsapp.com','whatsapp.net'],
    'ChatGPT':['chatgpt.com','openai.com','oaistatic.com','oaiusercontent.com'],
    'Google':['google.com','googleapis.com','gstatic.com','googleusercontent.com'],
    'GitHub':['github.com','githubusercontent.com','githubassets.com'],
    'Apple':['apple.com','icloud.com','mzstatic.com'],
    'Discord':['discord.com','discordapp.com','discordapp.net'],
    'Instagram':['instagram.com','cdninstagram.com'],
    'TikTok':['tiktok.com','tiktokv.com','tiktokcdn.com'],
    'Meta / Facebook':['facebook.com','fbcdn.net','fb.me','messenger.com'],
    'X (Twitter)':['x.com','twitter.com','twimg.com'],
    'Россия: домены':['geosite:ru'],
    'Банки РФ':['sberbank.ru','sber.ru','tinkoff.ru','tbank.ru','vtb.ru','alfabank.ru'],
    'Госуслуги':['gosuslugi.ru','esia.gosuslugi.ru']
  };
  const serviceIpSets = { 'Россия: IP':['geoip:ru'] };
  const state = { tab:'json', autoUrl:'', serviceStates:{}, preset:'' };
  const shared = readSharedState();
  const saved = shared || safeParse(localStorage.getItem('incy-builder-v1'));
  const form = $('#builder');
  const services = $('#services');
  [...new Set([...Object.keys(serviceSets), ...Object.keys(serviceIpSets)])].forEach((name) => {
    const id = `service-${name}`;
    services.insertAdjacentHTML('beforeend', `<button id="${id}" class="service" type="button" data-service="${name}" data-state="off"><span>${name}</span><small>выкл</small></button>`);
  });
  restore(saved);
  if (!saved || !saved.mode) applyModePreset('direct', false);

  form.addEventListener('input', update);
  form.addEventListener('change', (event) => { if (event.target.name === 'mode') applyModePreset(event.target.value); else update(); });
  document.querySelectorAll('.segmented label').forEach((card) => card.addEventListener('click', () => {
    const nextMode = card.querySelector('[name="mode"]').value;
    requestAnimationFrame(() => { if (mode() === nextMode) applyModePreset(nextMode); });
  }));
  services.addEventListener('click', (event) => { const chip = event.target.closest('[data-service]'); if (chip && !chip.disabled) cycleService(chip.dataset.service); });
  $('#clearServices').addEventListener('click', () => { state.serviceStates = {}; state.preset = 'custom'; update(); });
  $('#remoteDNS').addEventListener('change', () => { $('#customDNS').classList.toggle('hidden', $('#remoteDNS').value !== 'custom'); });
  document.querySelectorAll('.tabs button').forEach((button) => button.addEventListener('click', () => { state.tab = button.dataset.tab; document.querySelector('.tabs .active').classList.remove('active'); button.classList.add('active'); render(); }));
  $('#copy').addEventListener('click', copyCurrent);
  $('#download').addEventListener('click', downloadProfile);
  const shareButton = $('#share'); if (shareButton) shareButton.addEventListener('click', copyShareLink);
  update();

  function safeParse(text) { try { return JSON.parse(text || '{}'); } catch { return {}; } }
  function decodeBase64Utf8(value) { try { return decodeURIComponent(Array.from(atob(value), c => '%' + c.charCodeAt(0).toString(16).padStart(2,'0')).join('')); } catch { return ''; } }
  function readSharedState() {
    const raw = new URLSearchParams(location.search).get('s');
    if (!raw || raw.length > 12000) return null;
    const data = safeParse(decodeBase64Utf8(raw));
    if (!data || typeof data !== 'object' || !['direct','proxy','whitelist'].includes(data.mode)) return null;
    const allowed = new Set([...Object.keys(serviceSets), ...Object.keys(serviceIpSets)]);
    data.serviceStates = Object.fromEntries(Object.entries(data.serviceStates || {}).filter(([name, choice]) => allowed.has(name) && ['proxy','direct'].includes(choice)));
    return data;
  }
  function restore(data) {
    if (!data || typeof data !== 'object') return;
    if (data.mode === 'selective') data.mode = 'direct';
    if (data.mode === 'global') data.mode = 'proxy';
    if (data.mode === 'ru-direct') data.mode = 'direct';
    Object.entries(data).forEach(([key, value]) => {
      const el = document.getElementById(key);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = Boolean(value);
      else if (el.type === 'radio') el.checked = el.value === value;
      else el.value = String(value);
    });
    state.serviceStates = data.serviceStates && typeof data.serviceStates === 'object' ? data.serviceStates : {};
    state.preset = ['direct','proxy','whitelist','custom'].includes(data.preset) ? data.preset : '';
    (data.selectedServices || []).forEach(name => { if (!state.serviceStates[name]) state.serviceStates[name] = 'proxy'; });
    $('#customDNS').classList.toggle('hidden', $('#remoteDNS').value !== 'custom');
  }
  function cssEscape(v) { return v.replace(/["\\]/g, '\\$&'); }
  function value(id) { return $(id).value.trim(); }
  function bool(id) { return $(id).checked; }
  function lines(id, kind) {
    return value(id).split(/\r?\n|,/).map(x => x.trim()).filter(Boolean).filter(x => validate(x, kind));
  }
  function validate(item, kind) {
    if (item.length > 253 || /[\x00-\x20<>"'`]/.test(item)) return false;
    if (kind === 'domain') return /^(?:geosite:[a-z0-9._-]+|\*?\.?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/i.test(item);
    if (kind === 'ip') return /^(?:geoip:[a-z0-9._-]+|(?:\d{1,3}\.){3}\d{1,3}(?:\/(?:[0-9]|[12][0-9]|3[0-2]))?|[0-9a-f:]+(?:\/[0-9]{1,3})?)$/i.test(item);
    return false;
  }
  function httpsUrl(v) { try { const u = new URL(v); return u.protocol === 'https:' && u.hostname.length < 254; } catch { return false; } }
  function selectedDomains(kind) { return Object.entries(state.serviceStates).filter(([, choice]) => choice === kind).flatMap(([name]) => serviceSets[name] || []); }
  function selectedIPs(kind) { return Object.entries(state.serviceStates).filter(([, choice]) => choice === kind).flatMap(([name]) => serviceIpSets[name] || []); }
  function cycleService(name) { const order = ['off','proxy','direct']; const current = state.serviceStates[name] || 'off'; const next = order[(order.indexOf(current) + 1) % order.length]; if (next === 'off') delete state.serviceStates[name]; else state.serviceStates[name] = next; state.preset = 'custom'; update(); }
  function mode() { return document.querySelector('[name="mode"]:checked').value; }
  function collect() {
    const currentMode = mode();
    const whitelistDomains = currentMode === 'whitelist' ? lines('#whitelistDomains','domain') : []; const whitelistIPs = currentMode === 'whitelist' ? lines('#whitelistIPs','ip') : [];
    const chipDirectDomains = currentMode === 'direct' || currentMode === 'whitelist' ? selectedDomains('direct') : []; const chipDirectIPs = currentMode === 'direct' || currentMode === 'whitelist' ? selectedIPs('direct') : [];
    const directDomains = [...chipDirectDomains, ...whitelistDomains, ...lines('#directDomains','domain')]; const directIPs = [...chipDirectIPs, ...whitelistIPs, ...lines('#directIPs','ip')];
    const serviceDomains = currentMode === 'direct' ? selectedDomains('proxy') : [];
    const proxyDomains = [...new Set([...serviceDomains, ...lines('#proxyDomains','domain')])]; const proxyIPs = lines('#proxyIPs','ip');
    if (currentMode === 'proxy') { directDomains.unshift('geosite:ru'); directIPs.unshift('geoip:ru'); }
    const remote = value('#remoteDNS'); const domestic = value('#domesticDNS');
    const dns = remote === 'google' ? ['https://dns.google/dns-query','8.8.8.8'] : remote === 'custom' ? [value('#customDNSUrl'),value('#customDNSIP')] : ['https://cloudflare-dns.com/dns-query','1.1.1.1'];
    const local = domestic === 'cloudflare' ? ['DoH','https://cloudflare-dns.com/dns-query','1.1.1.1'] : domestic === 'google' ? ['DoH','https://dns.google/dns-query','8.8.8.8'] : ['DoU','','8.8.8.8'];
    const profile = {
      Name: cleanName(value('#profileName')) || 'Профиль INCY', GlobalProxy: String(currentMode !== 'direct'), LastUpdated: String(Math.floor(Date.now()/1000)),
      RemoteDNSType:'DoH', RemoteDNSDomain:dns[0], RemoteDNSIP:dns[1], DomesticDNSType:local[0], DomesticDNSDomain:local[1], DomesticDNSIP:local[2],
      DirectSites:[...new Set(directDomains)], DirectIp:[...new Set(directIPs)], ProxySites:proxyDomains, ProxyIp:proxyIPs,
      BlockSites:lines('#blockDomains','domain'), BlockIp:lines('#blockIPs','ip'), DomainStrategy:'IPIfNonMatch', FakeDNS:String(bool('#fakeDNS'))
    };
    const geoip = value('#geoipurl'), geosite = value('#geositeurl');
    if (httpsUrl(geoip)) profile.Geoipurl = geoip;
    if (httpsUrl(geosite)) profile.Geositeurl = geosite;
    if (bool('#chunks')) profile.useChunkFiles = true;
    return profile;
  }
  function cleanName(v) { return v.replace(/[\x00-\x1f<>]/g,'').slice(0,80); }
  function update() {
    const profile = collect(); state.profile = profile;
    const currentMode = mode();
    services.classList.remove('is-disabled');
    services.querySelectorAll('[data-service]').forEach((chip) => { chip.disabled = false; chip.setAttribute('aria-disabled', 'false'); });
    $('#clearServices').disabled = false;
    paintServices();
    const data = {}; form.querySelectorAll('input,textarea,select').forEach(el => { if (el.id) data[el.id] = el.type === 'checkbox' ? el.checked : el.value; if (el.name === 'mode' && el.checked) data.mode = el.value; });
    data.serviceStates = state.serviceStates; data.preset = state.preset; localStorage.setItem('incy-builder-v1', JSON.stringify(data));
    $('#whitelistBox').classList.toggle('hidden', currentMode !== 'whitelist');
    const labels = {direct:'Трафик напрямую',proxy:'Трафик через прокси',whitelist:'Трафик по белому списку'}; const hints = {direct:'Режим применяет набор зарубежных сервисов для прокси. Нажмите карточку ещё раз, чтобы восстановить его.',proxy:'Режим очищает наборы сервисов: весь трафик идёт через прокси, кроме geosite:ru и geoip:ru.',whitelist:'Режим добавляет Россию в прямой трафик. Нажмите карточку ещё раз, чтобы восстановить набор.'}; $('#summary').textContent = labels[currentMode]; $('#modeHint').textContent = hints[currentMode];
    const presetText = state.preset === 'custom' ? 'Индивидуальная настройка: наборы изменены вручную.' : 'Активна предустановка: ' + labels[state.preset || currentMode] + '.';
    $('#presetStatus').textContent = presetText;
    render();
  }
  function applyModePreset(nextMode, shouldUpdate = true) { const foreign = ['YouTube','Telegram','WhatsApp','ChatGPT','Discord','Instagram','TikTok','Meta / Facebook','X (Twitter)']; const presets = {direct:Object.fromEntries(foreign.map(name => [name,'proxy'])),proxy:{},whitelist:{'Россия: домены':'direct','Россия: IP':'direct'}}; state.serviceStates = presets[nextMode] || {}; state.preset = nextMode; if (shouldUpdate) update(); }
  function paintServices() { services.querySelectorAll('[data-service]').forEach((chip) => { const choice = state.serviceStates[chip.dataset.service] || 'off'; chip.dataset.state = choice; chip.querySelector('small').textContent = choice === 'proxy' ? 'через прокси' : choice === 'direct' ? 'напрямую' : 'выкл'; }); }
  function issues() {
    const warnings=[];
    ['#proxyDomains','#directDomains','#whitelistDomains','#blockDomains'].forEach(id => { const raw=value(id).split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean); if(raw.some(x=>!validate(x,'domain'))) warnings.push('Часть доменов исключена: допускаются домены и geosite:теги без пробелов.'); });
    ['#proxyIPs','#directIPs','#whitelistIPs','#blockIPs'].forEach(id => { const raw=value(id).split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean); if(raw.some(x=>!validate(x,'ip'))) warnings.push('Часть IP-правил исключена: используйте IP, CIDR или geoip:тег.'); });
    if (value('#remoteDNS') === 'custom' && (!httpsUrl(value('#customDNSUrl')) || !validate(value('#customDNSIP'),'ip'))) warnings.push('Свой удалённый DNS не включён: нужен HTTPS URL DoH и IP.');
    if (value('#geoipurl') && !httpsUrl(value('#geoipurl'))) warnings.push('URL geoip.dat пропущен: разрешены только HTTPS-адреса.');
    if (value('#geositeurl') && !httpsUrl(value('#geositeurl'))) warnings.push('URL geosite.dat пропущен: разрешены только HTTPS-адреса.');
    return [...new Set(warnings)];
  }
  function base64Utf8(text) { return btoa(unescape(encodeURIComponent(text))); }
  function currentText() {
    const json = JSON.stringify(state.profile,null,2);
    if (state.tab === 'json') return json;
    if (state.tab === 'link') return 'incy://routing/onadd/' + base64Utf8(json);
    return state.autoUrl ? 'incy://autorouting/onadd/' + state.autoUrl : 'Чтобы создать автообновляемую ссылку, сначала скачайте JSON, разместите его по HTTPS и вставьте этот адрес ниже.';
  }
  function render() {
    const warnings=issues(); $('#warnings').innerHTML = warnings.map(w=>`<p class="warning">⚠ ${escapeHtml(w)}</p>`).join('');
    $('#status').textContent = warnings.length ? 'Есть замечания' : 'Профиль готов'; $('#status').style.color = warnings.length ? '#98550d' : '';
    if(state.tab==='auto') {
      const controls = `<label class="auto-url"><span>HTTPS-адрес размещённого JSON</span><input id="autoUrl" placeholder="https://incy.nidox.ru/profile.json" value="${escapeAttr(state.autoUrl)}"></label>`;
      $('#preview').innerHTML = controls + `<code>${escapeHtml(currentText())}</code>`;
      $('#autoUrl').addEventListener('input', e=>{state.autoUrl=e.target.value.trim(); render();});
    } else $('#preview').textContent=currentText();
  }
  function escapeHtml(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));} function escapeAttr(s){return escapeHtml(s).replace(/"/g,'&quot;');}
  async function copyCurrent(){ const text=currentText(); if(state.tab==='auto' && !httpsUrl(state.autoUrl)) { alert('Введите HTTPS-адрес уже размещённого JSON-файла.'); return;} try {await navigator.clipboard.writeText(text); $('#copy').textContent='Скопировано'; setTimeout(()=>$('#copy').textContent='Скопировать',1500);} catch {alert('Не удалось скопировать. Выделите текст в окне предпросмотра.');} }
  function shareData() { const data = {}; form.querySelectorAll('input,textarea,select').forEach(el => { if (el.id) data[el.id] = el.type === 'checkbox' ? el.checked : String(el.value).slice(0,2000); if (el.name === 'mode' && el.checked) data.mode = el.value; }); data.serviceStates = state.serviceStates; data.preset = state.preset; return data; }
  async function copyShareLink() { const payload = base64Utf8(JSON.stringify(shareData())); const url = new URL(location.href); url.search = payload.length <= 12000 ? 's=' + encodeURIComponent(payload) : ''; if (!url.search) { alert('Настройка слишком велика для ссылки. Скачайте JSON-файл.'); return; } try { await navigator.clipboard.writeText(url.href); if ($('#share')) { $('#share').textContent='Ссылка скопирована'; setTimeout(()=>$('#share').textContent='Скопировать настройку',1800); } } catch { alert('Не удалось скопировать ссылку.'); } }
  function downloadProfile(){const blob=new Blob([JSON.stringify(state.profile,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(state.profile.Name.replace(/[^\wа-яё-]+/gi,'-').slice(0,50)||'incy-profile')+'.json';a.click();URL.revokeObjectURL(a.href);}
})()
