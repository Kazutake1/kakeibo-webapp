// Budget category management. Loaded before the UI initializer.
function renderItemManager(){if(!document.getElementById('itemType'))return;const selected=itemType.dataset.ready?itemType.value:'variable';itemType.innerHTML=TYPES.map(t=>`<option value="${t.key}">${t.label}</option>`).join('');itemType.value=selected||'variable';itemType.dataset.ready='1';renderItemList()}
function bindItemListActions(){
  const list=document.getElementById('itemList');
  if(!list||list.dataset.itemActionsBound==='1')return;
  list.addEventListener('click',event=>{
    if(!(event.target instanceof Element))return;
    const button=event.target.closest('button[data-item-action]');
    if(!button||!list.contains(button))return;
    const {itemAction:action,itemType:type,itemName:encoded}=button.dataset;
    if(!TYPES.some(t=>t.key===type)||!encoded)return;
    if(action==='edit')window.editItem(type,encoded);
    else if(action==='delete')window.deleteItem(type,encoded);
  });
  list.dataset.itemActionsBound='1';
}
function renderItemList(){
  if(!document.getElementById('itemList'))return;
  bindItemListActions();
  const type=itemType.value||'variable';
  const cats=catsFor(type);
  itemList.innerHTML=cats.length?cats.map(c=>`<div class="item-chip"><span>${escapeHtml(c)}</span><span class="item-chip-actions"><button class="edit-item" type="button" data-item-action="edit" data-item-type="${escapeHtml(type)}" data-item-name="${escapeHtml(encodeArg(c))}">編集</button><button class="delete-item" type="button" data-item-action="delete" data-item-type="${escapeHtml(type)}" data-item-name="${escapeHtml(encodeArg(c))}">削除</button></span></div>`).join(''):'<div class="empty">項目がありません</div>';
}
function addItem(){const type=itemType.value;const name=newItemName.value.trim();if(!name)return;if(catsFor(type).some(c=>c.toLowerCase()===name.toLowerCase())){alert('同じ名前の項目があります');return}const before=deepCopy(state);state.categories[type].push(name);const b=getBudget();if(!(name in b[type]))b[type][name]=0;if(!saveState()){state=before;return}newItemName.value='';render();itemType.value=type;renderItemList();updateCats()}
window.editItem=(type,encoded)=>{const oldName=decodeURIComponent(encoded);const input=prompt(`「${oldName}」の新しい項目名を入力してください`,oldName);if(input===null)return;const newName=input.trim();if(!newName||newName===oldName)return;if(catsFor(type).some(c=>c!==oldName&&c.toLowerCase()===newName.toLowerCase())){alert('同じ名前の項目があります');return}if(!confirm(`「${oldName}」を「${newName}」に変更しますか？\n過去の収支データと各月の予算にも反映されます。`))return;const before=deepCopy(state);state.categories[type]=catsFor(type).map(c=>c===oldName?newName:c);for(const tx of state.transactions){if(tx.type===type&&tx.category===oldName)tx.category=newName}for(const month of Object.values(state.budgets)){if(!month?.[type]||!(oldName in month[type]))continue;const oldValue=month[type][oldName];if(!(newName in month[type]))month[type][newName]=oldValue;delete month[type][oldName]}if(!saveState()){state=before;return}render();itemType.value=type;renderItemList();updateCats()};
window.deleteItem=(type,encoded)=>{const name=decodeURIComponent(encoded);if(!confirm(`「${name}」を削除しますか？\n過去の収支データは削除されません。`))return;const before=deepCopy(state);const deletionMonth=ym();state.categories[type]=catsFor(type).filter(c=>c!==name);for(const [monthKey,month] of Object.entries(state.budgets)){if(monthKey>=deletionMonth&&month?.[type])delete month[type][name]}if(!saveState()){state=before;return}render();itemType.value=type;renderItemList();updateCats()};
