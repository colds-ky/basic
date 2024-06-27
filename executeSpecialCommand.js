// @ts-check

(function () {
  var command = window['executeSpecialCommand'];
  window['executeSpecialCommand'] = executeSpecialCommand;

  if (typeof command === 'string')
    executeSpecialCommand(command);


  function executeSpecialCommand(command) {
    switch (command) {
      case 'update-dids':
        return updateDIDs();
      
      case 'update-index':
        return updateIndex();
    }
  }

  function updateDIDs() {
    alert('updateDIDs');
  }

  function updateIndex() {
    alert('updateIndex');
  }
})()