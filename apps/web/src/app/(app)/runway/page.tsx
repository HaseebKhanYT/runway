'use client';

import {ActivityPanel} from '../../../components/dashboard/activity_panel';
import {CategoriesPanel} from '../../../components/dashboard/categories_panel';
import {CrunchPanel} from '../../../components/dashboard/crunch_panel';
import {Hero} from '../../../components/dashboard/hero';
import {RunwayHorizontal} from '../../../components/dashboard/runway_horizontal';
import {RunwayVertical} from '../../../components/dashboard/runway_vertical';
import {useAppState} from '../../../lib/queries';
import {useMedia} from '../../../lib/use_media';
import {buildViewModel} from '../../../lib/view-model';

export default function RunwayPage() {
  const {data: state} = useAppState();
  const {isMobile} = useMedia();
  if (!state) return null;
  const vm = buildViewModel(state, new Date());

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      {vm.runway.safe < 0 ? <CrunchPanel state={state} vm={vm} /> : <Hero vm={vm} />}
      {isMobile ? (
        <RunwayVertical state={state} vm={vm} />
      ) : (
        <RunwayHorizontal state={state} vm={vm} />
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))',
          gap: 16,
        }}
      >
        <CategoriesPanel state={state} />
        <ActivityPanel state={state} />
      </div>
    </div>
  );
}
