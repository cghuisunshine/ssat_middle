/* Shared, password-free student profiles. Embedded in every standalone page. */
(function (root) {
  'use strict';
  const SUBJECTS = ['wordwise-ssat-middle-v1', 'ssat-middle-reading-v1', 'ssat-middle-writing-v1', 'ssat-middle-math-v1'];
  const LABELS = ['Vocabulary', 'Reading', 'Writing', 'Math'];
  const CURRENT = 'ssatMiddleStudent', KNOWN = 'ssatMiddleKnownStudents', MIGRATED = 'ssatMiddleLegacyOwner';
  const PREFIX = 'ssatMiddleStudents.v1:', BASE = 'ssatMiddleSyncBase.v1:';
  const normalize = name => String(name || '').trim().replace(/\s+/g, ' ');
  const idFor = name => encodeURIComponent(normalize(name).toLowerCase());
  let raw;
  try { raw = root.localStorage; }
  catch { raw = {getItem() { throw Error('Storage unavailable'); }, setItem() { throw Error('Storage unavailable'); }, removeItem() { throw Error('Storage unavailable'); }}; }
  const read = key => { try { return raw.getItem(key); } catch { return null; } };
  const parse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
  const validName = name => !!name && name.length <= 40 && !/[\u0000-\u001f\u007f]/.test(name);
  const known = () => {
    const names = parse(read(KNOWN), []);
    return Array.isArray(names) ? [...new Map(names.filter(n => typeof n === 'string' && validName(n)).map(n => [idFor(n), n])).values()] : [];
  };
  const storedName = read(CURRENT);
  // Capture the identity for this document. Another tab can never redirect a save.
  const student = validName(storedName) ? storedName : '';
  const keyFor = (name, subject) => PREFIX + idFor(name) + ':' + subject;
  const storage = {
    getItem(subject) { return student ? raw.getItem(keyFor(student, subject)) : null; },
    setItem(subject, value) {
      if (!student) throw Error('Choose a student before saving progress.');
      raw.setItem(keyFor(student, subject), value);
      root.dispatchEvent(new root.Event('ssat-progress-saved'));
    },
    removeItem(subject) { if (student) raw.removeItem(keyFor(student, subject)); }
  };
  function login(input) {
    let name = normalize(input);
    if (!validName(name)) throw Error('Enter a student name using 1–40 characters.');
    name = known().find(n => idFor(n) === idFor(name)) || name;
    // Copy before assigning an owner; keep the originals as a recovery copy.
    // A failed migration can be retried without overwriting any student data.
    if (!read(MIGRATED)) {
      for (const subject of SUBJECTS) {
        const value = raw.getItem(subject), destination = keyFor(name, subject);
        if (value !== null && raw.getItem(destination) === null) raw.setItem(destination, value);
      }
      raw.setItem(MIGRATED, name);
    }
    raw.setItem(KNOWN, JSON.stringify([name, ...known().filter(n => idFor(n) !== idFor(name))]));
    raw.setItem(CURRENT, name);
    return name;
  }
  function logout() { raw.removeItem(CURRENT); }
  function forget(name) {
    // Removing a shortcut never deletes a student's saved work.
    raw.setItem(KNOWN, JSON.stringify(known().filter(n => idFor(n) !== idFor(name))));
  }
  const valuesFor = name => Object.fromEntries(SUBJECTS.map(key => [key, read(keyFor(name, key))]));
  function exportStudent() {
    if (!student) throw Error('Choose a student first.');
    return {kind: 'ssat-middle-student', version: 1, student, exportedAt: new Date().toISOString(), subjects: valuesFor(student)};
  }
  function validSubject(key, value) {
    if (value === null) return true;
    if (typeof value !== 'string') return false;
    const state = parse(value, null);
    if (!state || state.version !== 1) return false;
    if (key === SUBJECTS[2]) return Array.isArray(state.drafts);
    if (!state.records || typeof state.records !== 'object' || Array.isArray(state.records)) return false;
    if (key === SUBJECTS[0]) return Array.isArray(state.custom) && !!state.settings;
    if (key === SUBJECTS[3]) return state.kind === 'ssat-middle-math';
    return !!state.notes && !!state.bookmarks;
  }

  // Optional Firebase sync uses its own collection, never AMC 8 records.
  // Sync is explicit. Three-way comparison detects edits on both devices.
  // The student chooses which version to use; both are exported before resolving.
  const CONFIG = {authDomain: 'homeinventory-4718c.firebaseapp.com', projectId: 'homeinventory-4718c', storageBucket: 'homeinventory-4718c.firebasestorage.app', messagingSenderId: '719884896213', appId: '1:719884896213:web:e93d5dffc79dec10995f5c'};
  let sdk, database, databaseKey;
  async function getDatabase(apiKey) {
    if (!apiKey) throw Error('Enter your Firebase API key first.');
    if (!sdk) sdk = (async () => {
      for (const file of ['firebase-app-compat.js', 'firebase-firestore-compat.js']) {
        if (file.startsWith('firebase-app') ? root.firebase?.initializeApp : root.firebase?.firestore) continue;
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://www.gstatic.com/firebasejs/9.23.0/' + file;
          const timer = setTimeout(() => { script.remove(); reject(Error('Firebase could not load. Check your connection and try again.')); }, 15000);
          script.onload = () => { clearTimeout(timer); resolve(); };
          script.onerror = () => { clearTimeout(timer); script.remove(); reject(Error('Firebase could not load. Check your connection and try again.')); };
          document.head.append(script);
        });
      }
    })().catch(error => { sdk = null; throw error; });
    await sdk;
    if (!database || databaseKey !== apiKey) {
      database = root.firebase.initializeApp({...CONFIG, apiKey}, 'ssatMiddle-' + Date.now()).firestore();
      databaseKey = apiKey;
    }
    return database;
  }
  function mergeSubjects(local, remote, base, resolution) {
    const merged = {}, conflicts = [];
    for (const key of SUBJECTS) {
      const a = local[key] ?? null, b = remote[key] ?? null, before = base[key] ?? null;
      if (!validSubject(key, a)) throw Error('This device contains unreadable progress. Back it up before syncing.');
      if (!validSubject(key, b)) throw Error('The cloud copy contains invalid ' + LABELS[SUBJECTS.indexOf(key)] + ' progress. Local progress was kept.');
      if (a === b || b === before) merged[key] = a;
      else if (a === before) merged[key] = b;
      else if (resolution === 'device') merged[key] = a;
      else if (resolution === 'cloud') merged[key] = b;
      else { conflicts.push(key); merged[key] = a; }
    }
    return {merged, conflicts};
  }
  async function sync(apiKey, resolution) {
    if (!student) throw Error('Choose a student first.');
    const local = valuesFor(student), base = parse(read(BASE + idFor(student)), {});
    const db = await getDatabase(apiKey), ref = db.collection('ssatMiddleStudents').doc(idFor(student));
    const result = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref), cloud = snapshot.exists ? snapshot.data() : null;
      if (cloud && (cloud.version !== 1 || idFor(cloud.student) !== idFor(student) || !cloud.subjects || !SUBJECTS.every(key => Object.hasOwn(cloud.subjects, key)))) throw Error('The cloud profile could not be read. Local progress was kept.');
      const remote = cloud?.subjects || {}, result = mergeSubjects(local, remote, cloud ? base : {}, resolution);
      if (result.conflicts.length) return {...result, remote};
      transaction.set(ref, {version: 1, student, subjects: result.merged, updatedAt: new Date().toISOString()});
      return result;
    });
    if (result.conflicts.length) return {...result, local};
    let changed = false, pending = false;
    // Never replace edits made while the network request was in flight.
    for (const key of SUBJECTS) {
      const current = read(keyFor(student, key));
      if (current !== local[key]) { pending = true; continue; }
      if (result.merged[key] !== current) {
        if (result.merged[key] === null) raw.removeItem(keyFor(student, key));
        else raw.setItem(keyFor(student, key), result.merged[key]);
        changed = true;
      }
    }
    raw.setItem(BASE + idFor(student), JSON.stringify(result.merged));
    raw.setItem('ssatMiddleFirebaseApiKey', apiKey);
    raw.removeItem('ssatMiddleSyncLocalOnly');
    return {changed, pending, conflicts: []};
  }

  root.SSATUsers = {student, SUBJECTS, LABELS, storage, login, logout, known, forget, idFor, keyFor, exportStudent, mergeSubjects, sync};
  if (typeof document === 'undefined') return;
  function mount() {
    const $ = id => document.getElementById(id);
    const bar = document.createElement('div');
    bar.className = 'ssat-user-bar';
    bar.innerHTML = '<div class="ssat-user-inner"><span class="ssat-user-hint">YOUR STUDY SPACE</span><button type="button" id="student-button" aria-haspopup="dialog"><span class="ssat-user-avatar" aria-hidden="true"></span><span id="student-name-label"></span><span class="ssat-user-switch">Switch</span></button><button type="button" id="student-settings" aria-haspopup="dialog">Student settings</button></div>';
    document.body.prepend(bar);
    const dialog = document.createElement('dialog');
    dialog.id = 'student-dialog';
    dialog.setAttribute('aria-labelledby', 'student-dialog-title');
    dialog.innerHTML = '<div class="ssat-user-dialog"><div class="ssat-user-kicker">SSAT MIDDLE LEVEL</div><button type="button" id="student-close" aria-label="Close student settings">×</button><h2 id="student-dialog-title">Who’s practicing?</h2><p id="student-dialog-description">Each student’s answers, notes, drafts, and reviews are kept separately. Your name is remembered on this device.</p><div id="student-chooser"><div id="known-students" aria-label="Recent students"></div><form id="login-form"><label for="login-name">Student name</label><input id="login-name" name="student" maxlength="40" required autocomplete="off" placeholder="e.g. Peggy"><button type="submit" class="ssat-user-primary">Start practicing →</button></form></div><div id="student-options" hidden><p id="student-storage-status">Progress is saved on this device. Choose Sync now to exchange progress with another device.</p><div class="ssat-user-actions"><button type="button" id="student-switch">Switch student</button><button type="button" id="student-signout">Sign out</button><button type="button" id="student-export">Back up all subjects</button><button type="button" id="student-import">Restore student backup</button><input type="file" id="student-import-file" accept="application/json,.json" hidden></div><div id="student-restore-preview" hidden><p id="student-restore-description"></p><button type="button" id="student-restore-confirm">Download current progress &amp; restore</button></div><details id="student-cloud"><summary>Sync across devices</summary><p>Optional Firebase sync, using the same project as the AMC 8 studio. Sign in with the same student name on each device, then choose Sync now. Names are shared profiles without passwords.</p><label for="firebase-key">Firebase API key</label><input type="password" id="firebase-key" autocomplete="off" placeholder="Enter your Firebase API key"><div class="ssat-user-actions"><button type="button" id="student-sync">Sync now</button><button type="button" id="student-local">Use this device only</button></div><p id="student-sync-status" role="status" aria-live="polite"></p><div id="student-conflicts" hidden><p>Both devices changed the same subject. Download both versions before choosing which to keep.</p><div class="ssat-user-actions"><button type="button" id="student-conflict-export">Download both versions</button><button type="button" id="student-keep-device" disabled>Use device version</button><button type="button" id="student-keep-cloud" disabled>Use cloud version</button></div></div></details></div><p id="student-error" role="alert"></p><p class="ssat-user-footnote">No password needed. These profiles keep progress organized on a shared device; anyone who uses the same name can open that profile.</p></div>';
    document.body.append(dialog);
    $('student-name-label').textContent = student || 'Choose student';
    bar.querySelector('.ssat-user-avatar').textContent = student ? [...student][0].toUpperCase() : '?';
    document.title += student ? ' · ' + student : '';
    let conflict;
    function show(settings = false) {
      $('student-error').textContent = '';
      $('student-chooser').hidden = settings && !!student;
      $('student-options').hidden = !settings || !student;
      $('student-close').hidden = !student;
      $('student-dialog-title').textContent = settings && student ? student + '’s study space' : 'Who’s practicing?';
      $('student-dialog-description').hidden = settings && !!student;
      $('known-students').replaceChildren();
      for (const name of known()) {
        const row = document.createElement('div'); row.className = 'ssat-known-row';
        const button = document.createElement('button'); button.type = 'button'; button.textContent = name;
        if (idFor(name) === idFor(student)) button.setAttribute('aria-current', 'true');
        button.onclick = () => choose(name);
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove ' + name + ' from recent students'); remove.title = 'Remove shortcut; saved progress is kept';
        remove.onclick = () => { try { forget(name); show(); } catch { failStorage(); } };
        row.append(button, remove); $('known-students').append(row);
      }
      if (!dialog.open) dialog.showModal();
      if (!settings) $('login-name').focus();
    }
    function failStorage() { $('student-error').textContent = 'Browser storage is unavailable or full. Allow local storage to choose a student. Existing progress has been kept.'; }
    function choose(name) { try { login(name); root.location.reload(); } catch (error) { $('student-error').textContent = error.message.includes('student name') ? error.message : 'Could not save the student profile. Allow browser storage or free some space, then try again.'; } }
    function download(payload, filename) {
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    $('login-form').onsubmit = event => { event.preventDefault(); choose($('login-name').value); };
    $('student-button').onclick = () => show();
    $('student-settings').onclick = () => show(true);
    $('student-switch').onclick = () => show();
    $('student-close').onclick = () => dialog.close();
    dialog.addEventListener('cancel', event => { if (!student) event.preventDefault(); });
    $('student-signout').onclick = () => { try { logout(); root.location.reload(); } catch { failStorage(); } };
    $('student-export').onclick = () => download(exportStudent(), 'ssat-student-backup.json');
    let restoreBackup;
    $('student-import').onclick = () => { $('student-import-file').value = ''; $('student-import-file').click(); };
    $('student-import-file').onchange = async event => {
      $('student-restore-preview').hidden = true;
      $('student-error').textContent = '';
      try {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) throw Error('Choose a backup smaller than 20 MiB.');
        const backup = JSON.parse(await file.text());
        if (backup.kind !== 'ssat-middle-student' || backup.version !== 1 || !backup.subjects || !SUBJECTS.every(key => Object.hasOwn(backup.subjects, key) && validSubject(key, backup.subjects[key]))) throw Error('Choose an SSAT student backup created with Back up all subjects.');
        if (idFor(backup.student) !== idFor(student)) throw Error('This backup belongs to ' + normalize(backup.student) + '. Switch to that student before restoring.');
        restoreBackup = backup;
        $('student-restore-description').textContent = 'Restore all four subjects for ' + student + '? This replaces their current progress on this device. A copy of the current progress will download first.';
        $('student-restore-preview').hidden = false;
      } catch (error) { $('student-error').textContent = error.message || 'Could not read this backup.'; }
    };
    $('student-restore-confirm').onclick = () => {
      if (!restoreBackup) return;
      const previous = exportStudent();
      download(previous, 'ssat-before-restore.json');
      try {
        // Save a durable recovery copy before changing any subject.
        raw.setItem('ssatMiddleRestoreRecovery:' + idFor(student), JSON.stringify(previous));
        for (const key of SUBJECTS) {
          const value = restoreBackup.subjects[key];
          if (value === null) raw.removeItem(keyFor(student, key));
          else raw.setItem(keyFor(student, key), value);
        }
        root.location.reload();
      } catch {
        for (const key of SUBJECTS) {
          try {
            if (previous.subjects[key] === null) raw.removeItem(keyFor(student, key));
            else raw.setItem(keyFor(student, key), previous.subjects[key]);
          } catch { /* The downloaded recovery copy still contains every subject. */ }
        }
        $('student-error').textContent = 'Storage is unavailable or full. Restore did not finish; your downloaded copy contains the previous progress.';
      }
    };
    $('firebase-key').value = read('ssatMiddleSyncLocalOnly') === 'true' ? '' : read('ssatMiddleFirebaseApiKey') || read('firebaseApiKey') || '';
    $('student-local').onclick = () => {
      try { raw.removeItem('ssatMiddleFirebaseApiKey'); raw.setItem('ssatMiddleSyncLocalOnly', 'true'); $('firebase-key').value = ''; $('student-sync-status').textContent = 'Using this device only. Your saved progress is kept.'; } catch { failStorage(); }
    };
    async function runSync(resolution) {
      $('student-sync').disabled = true;
      $('student-keep-device').disabled = $('student-keep-cloud').disabled = true;
      $('student-sync-status').textContent = 'Connecting to Firebase…';
      try {
        const result = await sync($('firebase-key').value.trim(), resolution);
        conflict = result.conflicts.length ? result : null;
        $('student-conflicts').hidden = !conflict;
        if (conflict) $('student-sync-status').textContent = 'Choose a version for: ' + result.conflicts.map(key => LABELS[SUBJECTS.indexOf(key)]).join(', ') + '. Neither version has been overwritten.';
        else if (result.changed) root.location.reload();
        else $('student-sync-status').textContent = result.pending ? 'Synced. New edits on this device are waiting; choose Sync now again.' : 'All subjects synced · ' + new Date().toLocaleTimeString();
      } catch (error) {
        $('student-sync-status').textContent = error.code === 'permission-denied' ? 'Firebase denied access. Check permissions for the ssatMiddleStudents collection. Local progress is kept.' : 'Sync unavailable: ' + error.message + ' Your progress remains on this device.';
      } finally { $('student-sync').disabled = false; }
    }
    $('student-sync').onclick = () => runSync();
    $('student-conflict-export').onclick = () => {
      if (!conflict) return;
      download({kind: 'ssat-middle-sync-conflict', version: 1, student, device: conflict.local, cloud: conflict.remote}, 'ssat-sync-both-versions.json');
      $('student-keep-device').disabled = $('student-keep-cloud').disabled = false;
    };
    $('student-keep-device').onclick = () => runSync('device');
    $('student-keep-cloud').onclick = () => runSync('cloud');
    // Other tabs retain their captured identity and display it accurately.
    root.addEventListener('pageshow', event => { if (event.persisted) root.location.reload(); });
    if (!student) show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})(window);
