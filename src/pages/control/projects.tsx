// src/pages/control/projects.tsx
//
// Projects — minimal library for Block Coding programs (.rbk = Blockly workspace
// JSON) and named Settings presets, all in IndexedDB. List / open / rename /
// delete / duplicate; upload a .rbk; save & apply Settings presets.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import ControlLayout from '../../components/control/ControlLayout';
import {
  loadProjects,
  persistProjects,
  type RbkProject,
  loadPresets,
  persistPresets,
  type SettingsPreset,
} from '../../app/persistence';
import { setPendingWorkspace } from '../../app/editorBridge';
import { getSettings, setSettings } from '../../app/settingsStore';
import { cloneSettings } from '../../domain/settings';
import { showToast } from '../../ui/toast';
import styles from '../../styles/Projects.module.css';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<RbkProject[]>([]);
  const [presets, setPresets] = useState<SettingsPreset[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadProjects().then(setProjects);
    loadPresets().then(setPresets);
  }, []);

  const saveProjects = (list: RbkProject[]) => {
    setProjects(list);
    void persistProjects(list);
  };
  const savePresets = (list: SettingsPreset[]) => {
    setPresets(list);
    void persistPresets(list);
  };

  const openProject = (p: RbkProject) => {
    setPendingWorkspace(p.workspace);
    router.push('/control/modes/code');
  };
  const renameProject = (p: RbkProject) => {
    const name = window.prompt('Nama baru:', p.name);
    if (!name) return;
    saveProjects(projects.map((x) => (x.id === p.id ? { ...x, name: name.trim() } : x)));
  };
  const duplicateProject = (p: RbkProject) => {
    saveProjects([
      { ...p, id: `p_${Date.now()}`, name: `${p.name} (copy)`, savedAt: Date.now() },
      ...projects,
    ]);
  };
  const deleteProject = (p: RbkProject) => {
    if (!window.confirm(`Hapus "${p.name}"?`)) return;
    saveProjects(projects.filter((x) => x.id !== p.id));
  };

  const onUpload = async (file: File) => {
    try {
      const workspace = JSON.parse(await file.text());
      saveProjects([
        {
          id: `p_${Date.now()}`,
          name: file.name.replace(/\.rbk$|\.json$/i, ''),
          workspace,
          savedAt: Date.now(),
        },
        ...projects,
      ]);
      showToast('Project diimpor.', 'success');
    } catch {
      showToast('File .rbk tidak valid.', 'error');
    }
  };

  const savePreset = () => {
    const name = window.prompt('Nama preset settings:', 'Preset 1');
    if (!name) return;
    savePresets([
      {
        id: `s_${Date.now()}`,
        name: name.trim(),
        settings: cloneSettings(getSettings()),
        savedAt: Date.now(),
      },
      ...presets,
    ]);
    showToast('Preset settings disimpan.', 'success');
  };
  const applyPreset = (p: SettingsPreset) => {
    setSettings(cloneSettings(p.settings));
    showToast(`Preset "${p.name}" diterapkan.`, 'info');
  };
  const deletePreset = (p: SettingsPreset) => {
    if (!window.confirm(`Hapus preset "${p.name}"?`)) return;
    savePresets(presets.filter((x) => x.id !== p.id));
  };

  return (
    <ControlLayout title="Projects">
      <div className={styles.page}>
        <div className={styles.head}>
          <h1 className={styles.h}>Block Coding Projects</h1>
          <div className={styles.actions}>
            <button className={styles.btn} onClick={() => fileRef.current?.click()}>
              Import .rbk
            </button>
            <button
              className={styles.btnPrimary + ' ' + styles.btn}
              onClick={() => router.push('/control/modes/code')}
            >
              + Editor baru
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".rbk,.json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className={styles.list}>
          {projects.length === 0 ? (
            <div className={styles.empty}>Belum ada project. Buka editor lalu tekan Save.</div>
          ) : (
            projects.map((p) => (
              <div key={p.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <div className={styles.itemName}>{p.name}</div>
                  <div className={styles.itemMeta}>
                    {new Date(p.savedAt).toLocaleString('id-ID')}
                  </div>
                </div>
                <div className={styles.itemBtns}>
                  <button
                    className={`${styles.iBtn} ${styles.iOpen}`}
                    onClick={() => openProject(p)}
                  >
                    Open
                  </button>
                  <button className={styles.iBtn} onClick={() => renameProject(p)}>
                    Rename
                  </button>
                  <button className={styles.iBtn} onClick={() => duplicateProject(p)}>
                    Duplicate
                  </button>
                  <button
                    className={`${styles.iBtn} ${styles.iDanger}`}
                    onClick={() => deleteProject(p)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.head}>
          <h2 className={styles.sectionTitle}>Settings Presets</h2>
          <button className={styles.btn} onClick={savePreset}>
            Simpan settings saat ini
          </button>
        </div>
        <div className={styles.list}>
          {presets.length === 0 ? (
            <div className={styles.empty}>Belum ada preset settings.</div>
          ) : (
            presets.map((p) => (
              <div key={p.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <div className={styles.itemName}>{p.name}</div>
                  <div className={styles.itemMeta}>
                    {new Date(p.savedAt).toLocaleString('id-ID')}
                  </div>
                </div>
                <div className={styles.itemBtns}>
                  <button
                    className={`${styles.iBtn} ${styles.iOpen}`}
                    onClick={() => applyPreset(p)}
                  >
                    Apply
                  </button>
                  <button
                    className={`${styles.iBtn} ${styles.iDanger}`}
                    onClick={() => deletePreset(p)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ControlLayout>
  );
}
