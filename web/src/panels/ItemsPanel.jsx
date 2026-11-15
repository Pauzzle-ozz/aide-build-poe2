import { useMemo, useState } from 'react';
import Window from '../components/Window.jsx';
import { ItemTooltip } from '../components/Tooltips.jsx';
import { useHoverCard } from '../components/HoverCard.jsx';

// la carte d'un objet se colle au bord gauche du panneau (elle ne cache plus l'équipement) et suit la souris en hauteur
const panelEdge = (e) => e.currentTarget.closest('.window')?.getBoundingClientRect().left ?? e.clientX;
import { SLOT_LABEL } from '@core/build-model.mjs';
import { img } from '../api.js';

// Disposition façon inventaire du jeu (colonne, ligne, largeur, hauteur)
const LAYOUT = {
  'Weapon 1': [1, 1, 2, 4],
  Helmet: [4, 1, 2, 2],
  Amulet: [6, 2, 1, 1],
  'Weapon 2': [7, 1, 2, 4],
  'Ring 1': [3, 3, 1, 1],
  'Body Armour': [4, 3, 2, 3],
  'Ring 2': [6, 3, 1, 1],
  Gloves: [1, 5, 2, 2],
  Belt: [4, 6, 2, 1],
  Boots: [7, 5, 2, 2],
  'Flask 1': [2, 7, 1, 2],
  'Charm 1': [4, 7, 1, 1],
  'Charm 2': [5, 7, 1, 1],
  'Charm 3': [6, 7, 1, 1],
  'Flask 2': [7, 7, 1, 2],
};

const RAR = { UNIQUE: 'unique', RARE: 'rare', MAGIC: 'magic', NORMAL: '' };

function slotMatches(it, slot) {
  const s = slot.replace(' Swap', '');
  if (s.startsWith('Ring')) return it.itemClass === 'Ring';
  if (s.startsWith('Charm')) return it.itemClass === 'Charm';
  if (s.startsWith('Flask')) return it.itemClass === 'Life Flask' || it.itemClass === 'Mana Flask';
  return it.slots.includes(s);
}

export default function ItemsPanel({ data, build, doOps, onClose, selectedSlot, setSelectedSlot, showToast }) {
  const hc = useHoverCard();
  const [picker, setPicker] = useState(null);
  const slot = selectedSlot && LAYOUT[selectedSlot] ? selectedSlot : null;
  const item = slot ? build.items[slot] : null;

  return (
    <Window title="Équipement" side="right" onClose={onClose}>
      <div
        className="equip-grid"
        style={{ gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 50px)', gridAutoRows: 'unset' }}
      >
        {Object.entries(LAYOUT).map(([id, [c, r, w, h]]) => {
          const it = build.items[id];
          return (
            <div
              key={id}
              className={`slot ${it ? RAR[it.rarity] || '' : ''} ${slot === id ? 'selected' : ''}`}
              style={{ gridColumn: `${c} / span ${w}`, gridRow: `${r} / span ${h}` }}
              onClick={() => {
                setSelectedSlot(id);
                if (!it) setPicker(id);
                else setPicker(null);
              }}
              onMouseEnter={(e) => it && hc.show(id, it, panelEdge(e), e.clientY, { dock: 'left' })}
              onMouseMove={(e) => it && hc.follow(id, panelEdge(e), e.clientY)}
              onMouseLeave={hc.hide}
            >
              {it?.iconUrl ? <img src={img(it.iconUrl)} alt="" loading="lazy" /> : it ? <span className="itemname">{it.name}</span> : null}
              {!it && <span className="label">{SLOT_LABEL[id]}</span>}
            </div>
          );
        })}
      </div>
      {hc.card && build.items[hc.card.key] && <ItemTooltip key={hc.card.key} item={build.items[hc.card.key]} x={hc.card.x} y={hc.card.y} card={hc.cardProps} buildItem />}

      {slot && (
        <>
          <div className="section-title">{SLOT_LABEL[slot]}</div>
          {item ? (
            <>
              <ItemTooltip item={item} floating={false} showEn buildItem />
              <div className="row" style={{ marginTop: 8, justifyContent: 'center' }}>
                <button className="btn small" onClick={() => setPicker(slot)}>Changer</button>
                <button className="btn small danger" onClick={() => doOps({ op: 'unequip', slot })}>Retirer</button>
              </div>
            </>
          ) : (
            !picker && <div className="empty">Emplacement vide — cliquez dessus pour choisir un objet.</div>
          )}
        </>
      )}
      {picker && <ItemPicker data={data} slot={picker} doOps={doOps} onDone={() => setPicker(null)} showToast={showToast} />}
      {!slot && <p className="muted small" style={{ marginTop: 12 }}>Cliquez sur un emplacement pour équiper un objet unique, créer un objet rare ou coller un objet copié depuis le jeu (Ctrl+C sur l'objet).</p>}
    </Window>
  );
}

function ItemPicker({ data, slot, doOps, onDone, showToast }) {
  const [tab, setTab] = useState('unique');
  const [q, setQ] = useState('');
  const hc = useHoverCard();
  const [rare, setRare] = useState({ base: null, name: '', rarity: 'RARE', mods: '' });
  const [text, setText] = useState('');
  const list = useMemo(() => {
    const src = tab === 'base' ? data.items.bases : data.items.uniques;
    const n = q.trim().toLowerCase();
    return src
      .filter((it) => slotMatches(it, slot))
      .filter((it) => !n || it.name.toLowerCase().includes(n) || it.nameEn.toLowerCase().includes(n) || (it.base || '').toLowerCase().includes(n) || (it.explicits || []).some((m) => m.toLowerCase().includes(n)))
      .slice(0, 150);
  }, [tab, q, slot, data]);

  const equip = async (op) => {
    const r = await doOps({ op: 'equip', slot, ...op });
    if (r) onDone();
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div className="section-title">Choisir un objet</div>
      <div className="row wrap" style={{ marginBottom: 8 }}>
        <button className={`btn small ${tab === 'unique' ? 'active' : ''}`} onClick={() => setTab('unique')}>Uniques</button>
        <button className={`btn small ${tab === 'base' ? 'active' : ''}`} onClick={() => setTab('base')}>Objet rare / magique</button>
        <button className={`btn small ${tab === 'paste' ? 'active' : ''}`} onClick={() => setTab('paste')}>Coller depuis le jeu</button>
        <div className="grow" />
        <button className="btn small ghost" onClick={onDone}>Annuler</button>
      </div>
      {tab === 'paste' ? (
        <>
          <textarea className="input code-box" placeholder={"Survolez l'objet en jeu, faites Ctrl+C puis collez ici.\n(Format du jeu ou de Path of Building)"} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
            <button className="btn" disabled={!text.trim()} onClick={() => equip({ text })}>Équiper</button>
          </div>
        </>
      ) : tab === 'base' && rare.base ? (
        <div>
          <ItemTooltip item={{ ...rare.base, rarity: rare.rarity, name: rare.name || rare.base.name, base: rare.base.name, explicitsFr: rare.mods.split('\n').filter(Boolean), implicitsFr: rare.base.implicits }} floating={false} />
          <div className="row" style={{ marginTop: 8 }}>
            <select className="input" value={rare.rarity} onChange={(e) => setRare({ ...rare, rarity: e.target.value })}>
              <option value="RARE">Rare</option>
              <option value="MAGIC">Magique</option>
              <option value="NORMAL">Normal</option>
            </select>
            <input className="input grow" placeholder="Nom de l'objet (ex : Fléau des Tempêtes)" value={rare.name} onChange={(e) => setRare({ ...rare, name: e.target.value })} />
          </div>
          <textarea className="input" style={{ width: '100%', minHeight: 110, marginTop: 6 }} placeholder={'Un modificateur par ligne, ex :\n+80 de Vie maximale\n+35% de Résistance au feu'} value={rare.mods} onChange={(e) => setRare({ ...rare, mods: e.target.value })} />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <button className="btn small ghost" onClick={() => setRare({ ...rare, base: null })}>← Autre base</button>
            <button className="btn" onClick={() => equip({ base: rare.base.id, name: rare.name || undefined, rarity: rare.rarity, mods: rare.mods.split('\n').map((s) => s.trim()).filter(Boolean) })}>Équiper</button>
          </div>
        </div>
      ) : (
        <>
          <input className="input" style={{ width: '100%' }} placeholder={tab === 'unique' ? 'Rechercher un unique (nom ou effet)…' : 'Rechercher une base…'} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="result-list" style={{ marginTop: 6 }}>
            {list.length === 0 && <div className="empty">Aucun objet trouvé pour cet emplacement.</div>}
            {list.map((it) => (
              <div
                key={it.id}
                className="result"
                onClick={() => (tab === 'unique' ? equip({ unique: it.id }) : setRare({ ...rare, base: it }))}
                onMouseEnter={(e) => hc.show(it.id, tab === 'unique' ? { ...it, rarity: 'UNIQUE', implicitsFr: it.implicits, explicitsFr: it.explicits } : { ...it, rarity: 'NORMAL' }, panelEdge(e), e.clientY, { dock: 'left' })}
                onMouseMove={(e) => hc.follow(it.id, panelEdge(e), e.clientY)}
                onMouseLeave={hc.hide}
              >
                {it.iconUrl && <img className="thumb" src={img(it.iconUrl)} alt="" loading="lazy" />}
                <div>
                  <div className="title" style={{ color: tab === 'unique' ? '#cf8a4a' : undefined }}>{it.name}</div>
                  <div className="sub">{tab === 'unique' ? it.base : it.classFr} {it.requirements?.[0] ? `· ${it.requirements[0]}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
          {hc.card && <ItemTooltip key={hc.card.key} item={hc.card.payload} x={hc.card.x} y={hc.card.y} card={hc.cardProps} />}
        </>
      )}
    </div>
  );
}
