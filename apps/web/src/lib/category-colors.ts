/** System category hues for non-user categories (catalog §4.1). */
export function catHue(catName: string, userCats: {name: string; color: string}[]): string {
  const user = userCats.find((c) => c.name === catName);
  if (user) return user.color;
  switch (catName) {
    case 'Income':
      return '#2e7d4f';
    case 'Bills':
      return '#5c5142';
    case 'Debt':
      return '#c2410c';
    case 'Subscription':
    case 'Goals':
      return '#8b6fd8';
    default:
      return '#a89b88';
  }
}
