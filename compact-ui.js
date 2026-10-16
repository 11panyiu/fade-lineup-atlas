/* Compact navigation for Fade Atlas. Keeps card editing and filters close to the content. */
(function(){
  'use strict';
  const workspace=document.getElementById('fadeWorkspace');
  if(!workspace)return;
  const tools=workspace.querySelector('.tools');
  const practiceLauncher=workspace.querySelector('.practice-launch');
  const practicePanel=document.getElementById('practicePanel');
  const mapLauncher=workspace.querySelector('.map-launch');
  const firstFilter=workspace.querySelector('.area-filter-bar');
  const cardHeading=workspace.querySelector('.status-bar');
  const originalAdd=document.getElementById('addBtn');
  if(!tools||!practiceLauncher||!practicePanel||!mapLauncher||!firstFilter||!cardHeading||!originalAdd)return;

  /* Keep the two optional features in one understated row, not two large cards. */
  const shortcuts=document.createElement('nav');
  shortcuts.className='atlas-shortcuts';
  shortcuts.setAttribute('aria-label','地图与复习快捷操作');
  tools.insertAdjacentElement('afterend',shortcuts);
  shortcuts.append(mapLauncher,practiceLauncher);
  shortcuts.insertAdjacentElement('afterend',practicePanel);

  /* A single compact filter row preserves existing group buttons and handlers. */
  const secondFilter=firstFilter.nextElementSibling;
  if(secondFilter&&secondFilter.classList.contains('area-filter-bar')){
    const consolidated=document.createElement('div');
    consolidated.className='atlas-fast-filters';
    firstFilter.insertAdjacentElement('beforebegin',consolidated);
    consolidated.append(firstFilter,secondFilter);
  }

  /* The existing add button is moved, not cloned, so original edit events remain intact. */
  cardHeading.appendChild(originalAdd);
  originalAdd.classList.add('atlas-add-near-cards');
  originalAdd.title='在 Fade 技能教学中添加新点位';
  cardHeading.setAttribute('aria-label','点位列表操作栏');
})();
