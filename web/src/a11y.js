// Accessibilité : un élément cliquable qui n'est pas un <button> (ligne de liste, case d'inventaire…)
// devient atteignable au clavier (Tab) et s'active avec Entrée ou Espace, comme un bouton.
// Usage : <div className="result" {...pressable(() => choisir(x), { 'aria-pressed': actif })}>
export function pressable(onPress, extra) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onPress,
    onKeyDown: (e) => {
      // touche reçue par un bouton ou un champ placé à l'intérieur : on le laisse faire
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      onPress(e);
    },
    ...extra,
  };
}
