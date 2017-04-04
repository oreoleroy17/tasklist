//Anonymous function

$(function() {
//import objTraverse from 'obj-traverse'

/*
This listchecker requires two custom fields.

Custom Field 1 is used to store the task listchecker
Custom Field 2 - is used to store states or groups and assumes at least one value is present
               - the values should represent Task Lists in the JSON file
*/

//jqueryNoConflict is used to read  the json file
var jqueryNoConflict = jQuery;  //set the JQuery var

// maxHeight is the maximum a template can be sized
let maxHeight = 350;



      // Initialise the Zendesk JavaScript API client
      // https://developer.zendesk.com/apps/docs/agent/zaf_v2

  var client = ZAFClient.init();

client.get('ticket.assignee.group.name').then(function(o){
  // GET CUSTOM FIELD ID FROM SETTINGS
  client.metadata().then(function(metadata) {
      //console.log(metadata.settings['storeID']);
      var restrictByGroup = metadata.settings['restrictByGroup'];
            if(o['ticket.assignee.group.name']!= restrictByGroup){
              client.invoke('app.hide');
            }else{
              client.invoke('app.show');
            }
  })
})

  //client.invoke('resize', { width: '100%', height: '250' });
  //client.invoke('ticketFields:custom_field_31548757.show');

  client.on('app.registered', function(){
    console.log('app registered');
    // GET CUSTOM FIELD ID FROM SETTINGS
    client.metadata().then(function(metadata) {
        //console.log(metadata.settings['storeID']);
        var storeTasksFieldID = metadata.settings['storeTasksFieldID'];
            client.invoke('ticketFields:custom_field_'+storeTasksFieldID+'.hide'
          ).catch(function(e){
              console.error("The custom field id does not exist!");
            })
            configuration();
    })

  });

  $(document).on('click','.css-checkbox',prepareTasksForStore);
  $(document).on('click','.cmn-toggle',showCustomField);



// *******  ZAF V2 = prevent Ticket save  *******
/*
client.on('ticket.save', function() {
  return false;
});
*/

function configuration(){

console.log('configuration called');

// GET CUSTOM FIELD ID FROM SETTINGS
client.metadata().then(function(metadata) {
    //console.log(metadata.settings['storeID']);
    var storeTasksFieldID = metadata.settings['storeTasksFieldID'];
    var taskGroupNamesFieldID = metadata.settings['taskGroupNamesFieldID'];
  // Get data from custom field
  client.get('ticket.customField:custom_field_'+storeTasksFieldID).then(function(arr) {
    //client.get('ticketFields:custom_field_51849927.options').then(function(items){
      client.get('ticket.customField:custom_field_'+taskGroupNamesFieldID).then(function(o){

            if(arr['ticket.customField:custom_field_'+storeTasksFieldID]){

                      //JSON.parse needed to convert JSON into object
                      singleTaskList = getSingleTaskList(JSON.parse(arr['ticket.customField:custom_field_'+storeTasksFieldID]), o['ticket.customField:custom_field_'+taskGroupNamesFieldID]);

                              if(singleTaskList == null){

                                console.log('no lists match kanban state, empty list');

                              }else{
                                //get Percent complete
                                //console.log(singleTaskList.Tasks[2].updated);
                                var objTasksCompleted = getTaskProgress(singleTaskList.Tasks, 'progress');
                                var objTasksModified = getModifiedTasks(singleTaskList.Tasks);
                                //console.log(objTasksCompleted);
                                var viewData = {listname: o['ticket.customField:custom_field_'+taskGroupNamesFieldID], tasks: objTasksModified, percentSolved: objTasksCompleted[0], alltaskscomplete: objTasksCompleted[1]};
                                var templateUrl = "tasks.hdbs";
                                //console.log(viewData);
                                //switchNavTo('assign');
                                switchView(templateUrl, viewData);

                              }
            }else{
              //custom field tasks was empty (very first load)
              return getFullJsonObj().then(function(arr){

                      //no JSON.parse as it is already an object
                    singleTaskList = getSingleTaskList(arr, o['ticket.customField:custom_field_'+taskGroupNamesFieldID]);

                    //console.log(JSON.stringify(singleTaskList));
                    if(singleTaskList == null){

                      console.log('no lists match kanban state, empty list');
                    }else{
                      //get Percent complete
                      var objTasksCompleted = getTaskProgress(singleTaskList.Tasks, 'progress');

                      var viewData = {listname: o['ticket.customField:custom_field_'+taskGroupNamesFieldID], tasks: singleTaskList.Tasks, percentSolved: objTasksCompleted[0], alltaskscomplete: objTasksCompleted[1] };
                      var templateUrl = "tasks.hdbs";
                      //console.log(viewData);
                      //switchNavTo('assign');
                      switchView(templateUrl, viewData);

                    }
            })
          }
        })
    }).catch(function(e){
        console.error("The custom field id does not exist!");
      })
  })

}
/*
TOGGLE CUSTOM FIELD USING TOGGLE switch
*/

function showCustomField(){
    console.log('showCustomField called');

    var inputs = $(".cmn-toggle")[0].checked;
    // GET CUSTOM FIELD ID FROM SETTINGS
    client.metadata().then(function(metadata) {
        //console.log(metadata.settings['storeTasksFieldID']);
        var storeTasksFieldID = metadata.settings['storeTasksFieldID'];
        if(inputs){
          //console.log("checked");
          client.invoke('ticketFields:custom_field_'+storeTasksFieldID+'.show');
        }else{
          //console.log("unchecked");
          client.invoke('ticketFields:custom_field_'+storeTasksFieldID+'.hide');
        }
      })
}
  /*
  findAndModifyFirst(tree, childrenKey, objToFindBy, replacementObj)

  tree = JSON object with parent and children
  childrenKey = 'Tasks' or the key name of the children objects
  objToFindBy = { name: value }
  replacementObj = {newname: new value}


  */
//****************************************************************************
// MODIFY AND REPLACE FUNCTION FOR SUBTASKS AND FULL TASK LIST = DO NOT CHANGE
//****************************************************************************
  const findInChildren = (obj, childrenKey, objToFindBy, replacementObj) => {
  console.log('findInChildren CALLED');
    //console.log(objToFindBy);
    //console.log(replacementObj);
    let findSuccess = false;
    let modifiedObj = false;
    const findChildrenKeys = Object.keys(objToFindBy);
    if (obj.hasOwnProperty(childrenKey)) {
      //console.log('has childrenKey');
      //console.log(obj[childrenKey].length);
      for (let i = 0; i < obj[childrenKey].length; i++) {
        findChildrenKeys.forEach((key) => {

          // check for null values
          if(obj[childrenKey][i][key] != '' && objToFindBy[key] != ''){
            //console.log(key);
          //  console.log(obj[childrenKey][i][key]);
            //console.log(objToFindBy[key]);
              if(key == 'name'){
                  _.isEqual(obj[childrenKey][i][key], objToFindBy[key]) ? findSuccess = true : findSuccess = false;
              }


              }
            });

        if (findSuccess) {
          //console.log('replace child');
          //console.log(obj[childrenKey][i]);
          //console.log(replacementObj);

          obj[childrenKey][i] = replacementObj;
          //console.log(obj[childrenKey][i]);
          modifiedObj = true;
          break;
        }
      }
      //console.log(modifiedObj);
      if (!findSuccess) {
        //console.log('no success');
        obj[childrenKey].forEach(child => findInChildren(child, childrenKey, objToFindBy, replacementObj));
      }
    } else if (modifiedObj != true){
      //console.log(obj.length);
      for (let i = 0; i < obj.length; i++) {

         findInChildren(obj[i], childrenKey, objToFindBy, replacementObj);
        }
    }

    return obj;
  }

function prepareTasksForStore(){
    /*****************************************
      Prepare object from form
    ****************************************/
    console.log('prepareTasksForStore called');


    var testTraverse;
    var objExisting;
    var objReplace;
    var arr;
    var singleTaskList;
    var d = new Date();
    var strDateTime = _.trim(formatDate(d));
    //console.log(strDateTime);


    // get checkbox form elements
    var inputs = $(' :input:not([type=button]) ');
    //console.log(inputs);
    //var inputs = this.$(" :input:not([type=button], .checkAll, .removeAll) ");
    //hidden field listname
    //console.log(inputs[0].name);

    //childrenKey used as search value in ModifyandFindFirst function
    var childrenKey = 'Tasks';

    // GET CUSTOM FIELD ID FROM SETTINGS
    client.metadata().then(function(metadata) {
        //console.log(metadata.settings['storeID']);
        var storeTasksFieldID = metadata.settings['storeTasksFieldID'];
        var taskGroupNamesFieldID = metadata.settings['taskGroupNamesFieldID'];
    // Get data from custom field
    client.get('ticket.customField:custom_field_'+storeTasksFieldID).then(function(data) {
    //client.get('ticketFields:custom_field_51849927.options').then(function(items){
      client.get('ticket.customField:custom_field_'+taskGroupNamesFieldID).then(function(o){


        //check if customfield is empty
          if(data['ticket.customField:custom_field_'+storeTasksFieldID]){

            //get total array from custom field task list
                 arr = JSON.parse(data['ticket.customField:custom_field_'+storeTasksFieldID]);
                //console.log(arr);

                // pull single task list
                singleTaskList = getSingleTaskList(arr, o['ticket.customField:custom_field_'+taskGroupNamesFieldID]);
                //console.log(singleTaskList);
// update value using findInChildren, return updated object
// replace old sub list in full object using modifyandfindfirst function


                _.each(inputs, function(item){
                  //console.log(item.name);
                  //console.log(this.$(item).prop('checked'));
                  //console.log(item.value);


                  //if checkbox is checked and checkbox value (o.value) is '', then new checked
                      if(this.$(item).prop('checked')==true && item.value==''){
                        //console.log('new check!');

                          objExisting = {id: item.id, name: item.name, value: ''};
                          objReplace = {id: item.id, name: item.name, value: true, updated: strDateTime};


                        //update value in sub task list
                          modSubTaskList = findInChildren(singleTaskList, childrenKey, objExisting, objReplace);

                          //console.log(objOldList);
                          //console.log(modSubTaskList);

                        //  modFullList = findAndModifyFirst(arr, o['ticket.customField:custom_field_51849927'], objOldList, modSubTaskList );

                        //console.log(modFullList);


                      }else if(this.$(item).prop('checked')==false && item.value=='checked'){
                        //console.log('uncheck!');
                      //if checkbox is not checked but checkbox value is checked, checkbox was unchecked

                          objExisting = {id: item.id, name: item.name, value: true};
                          objReplace = {id: item.id, name: item.name, value: '' };

                          //update value in sub task list
                            modSubTaskList = findInChildren(singleTaskList, childrenKey, objExisting, objReplace);

                            //console.log(objOldList);
                          //  console.log(modSubTaskList);

                      }else{

                      console.log('no changes were made');
                      }
                    }) //END EACH LOOP


          }else{


            //custom field tasks was empty (very first load)
            return getFullJsonObj().then(function(list){
                client.get('ticket.customField:custom_field_'+taskGroupNamesFieldID).then(function(o){

                 listarr = list;
                //console.log(listarr);
                // pull single task list
                singleTaskList = getSingleTaskList(listarr, o['ticket.customField:custom_field_'+taskGroupNamesFieldID]);
                //console.log(singleTaskList);

                _.each(inputs, function(item){
                  //console.log(item.name);
                  //console.log(this.$(item).prop('checked'));
                      if(this.$(item).prop('checked')==true ){

                          objExisting = {id: item.id, name: item.name, value: ''};
                          objReplace = {id: item.id, name: item.name, value: true, updated: strDateTime};

                          //console.log(objExisting);
                          //console.log(objReplace);

                          //update value in sub task list
                          modSubTaskList = findInChildren(singleTaskList, childrenKey, objExisting, objReplace);

                        //  console.log(singleTaskList);
                          //console.log(modSubTaskList);

                          //modFullList = findAndModifyFirst(arr, o['ticket.customField:custom_field_51849927'], singleTaskList, modSubTaskList );

                          //console.log(modFullList);

                      }
                    })
                    //console.log('line 212');
                    client.get('ticket.id').then(function(id){
                        //console.log(arr);
                        storeTasks(listarr, id['ticket.id'], storeTasksFieldID, taskGroupNamesFieldID);
                      })
            })
          })
          }
//console.log('line 220');
          client.get('ticket.id').then(function(id){
              //console.log(arr);
              storeTasks(arr, id['ticket.id'], storeTasksFieldID, taskGroupNamesFieldID);
            })
    })
  })
})
}

function storeTasks(data, ticketID, storeFieldID,taskGroupNamesFieldID){
        /*****************************************
          Store object in custom field on ticket
         ****************************************/
        console.log('storeTasks called');

            // load the ticket object from Zendesk
          //  var ticket = this.ticket();
          //  var ticketstatus = this.ticket().status();
          //var ticketID = data[0].value;

          //console.log(ticketID);
                    //var ticketStatus = client.get('ticket.status');
          //console.log(ticketID);
          //console.log(ticketStatus);
          //console.log(data);
          client.get('ticket.status').then(function(status) {
                //console.log(arr['ticket.status']);
                //console.log(ticketID);

    var ticketStatus = status['ticket.status'];
    if(ticketStatus !== 'closed'){

          //To Do => replace Custom Field ID with dynamic ID

          //client.set('ticket.customField:custom_field_31548757', '');
            var dat = {"ticket": {"custom_fields": [{"id": storeFieldID, "value": JSON.stringify(data)  }]}};



                         var settings = {   url: '/api/v2/tickets/' + ticketID + '.json',
                                            type:'PUT',
                                            contentType: 'application/json',
                                            dataType: 'json',
                                            processData: 'false',
                                            data: JSON.stringify(dat)
                                          };

                  client.request(settings).then(function(d) {


                              //console.log(d.ticket.fields[6].value);

                                        var msg = "Tasks were successfully updated!";
                                        console.log(msg);
                                        //client.invoke('ticketFields:custom_field_31548757.show');
                                        client.invoke('notify', [msg]);
                                          showSingleTaskList(JSON.parse(d.ticket.fields[6].value));
                                          //client.invoke('ticketFields:custom_field_31548757.show');
                                          //this.ticketFields(this.customFieldLabel()).show();
                              //showInfo(data);
                              //showNew(data);
                            },
                            function(response) {
                              console.log(response);
                              //showError(response);
                            }
                          );




         }else{

            var errmsg = "Tasks cannot be added to closed tickets!";
            //services.notify(errmsg, 'error');
          //  this.assignNewTaskList();
          }
            /*
            ticket.customField("custom_field_24680", "yes"); // type: checkbox
            ticket.customField("custom_field_34567", "vip"); // type: tagger
            */
          }) //end ticket status promise
      }

function showSingleTaskList(objFullList, storeFieldID, taskGroupFieldID){
          console.log('showSingleTaskList called');
          //objKanbanStates = getKanbanStates(kanbanoptions, o['ticket.customField:custom_field_51849927']);

          if (objFullList != null){
            client.get('ticket.customField:custom_field_'+taskGroupFieldID).then(function(o){
                      singleTaskList = getSingleTaskList(objFullList, o['ticket.customField:custom_field_'+taskGroupFieldID]);
                      //console.log(singleTaskList);

                      //console.log(JSON.stringify(singleTaskList));
                      if(singleTaskList == null){

                        console.log('no lists match kanban state, empty list');

                      }else{
                        //get Percent complete
                        var objTasksCompleted = getTaskProgress(singleTaskList.Tasks, 'progress');
                        var objTasksModified = getModifiedTasks(singleTaskList.Tasks);
                        var viewData = {listname: o['ticket.customField:custom_field_'+taskGroupFieldID], tasks: objTasksModified, percentSolved: objTasksCompleted[0], alltaskscomplete: objTasksCompleted[1] };
                        //console.log(viewData);
                        var templateUrl = "tasks.hdbs";
                        //console.log(viewData);
                        //switchNavTo('assign');
                        switchView(templateUrl, viewData);

                      }
                });
          }else{



          client.get('ticket.customField:custom_field_'+storeFieldID).then(function(arr) {
            client.get('ticket.customField:custom_field_'+taskGroupFieldID).then(function(o){


                  //console.log(arr);
                singleTaskList = getSingleTaskList(arr['ticket.customField:custom_field_'+storeFieldID], o['ticket.customField:custom_field_'+taskGroupFieldID]);
                //console.log(singleTaskList);

                //console.log(JSON.stringify(singleTaskList));
                if(singleTaskList == null){

                  console.log('no lists match kanban state, empty list');

                }else{
                  //get Percent complete
                  var objTasksCompleted = getTaskProgress(singleTaskList.Tasks);
                  var objTasksModified = getModifiedTasks(singleTaskList.Tasks);
                  var viewData = {listname: o['ticket.customField:custom_field_'+taskGroupFieldID], tasks: objTasksModified, percentSolved: objTasksCompleted };
                  //console.log(viewData);
                  var templateUrl = "tasks.hdbs";
                  //console.log(viewData);
                  //switchNavTo('assign');
                  switchView(templateUrl, viewData);

                }
            })
          })
          }
}


function getSingleTaskList(arr, val){
    console.log('getSingleTaskList called');
    //console.log(arr);
    //console.log(val);
    var result = _.find(arr, function(item) {

                    return item.Name == val || item.listID == val || item.name == val;

                    });
                    //console.log(result);
       return result;
  }
  function getModifiedTasks(tasks){

      console.log('getModifiedTasks called');
      var checked;
      var results = 0;
      var value;

       results = _.map(tasks, function(item){

        if(item.value == true){
          //console.log('is checked');
          checked = "checked";
          value = "checked";

        }else{
          //console.log('not checked');
            checked = "";
            value = "";
          }

          return { value: value, checked: checked, id: item.id, name: item.name, date: item.updated};

        });
        return results;
    }
  function getTaskProgress(tasks, flag){
    console.log('getTaskProgress');
    //accepts the Tasks array object
    // accepts flag to return Progress Percentage or Complete Indicator
    // valid flags = 'progress' or 'complete'

      /*
                      .mixin reference
                            var collection = [
                        { enabled: true },
                        { enabled: false },
                        { enabled: true },
                        { enabled: false }
                    ];

                    _.count(collection, 'enabled');
                    // → 2

                    _.count(collection, { enabled: false });
                    // → 2
                    */
                    //console.log(tasks);
                  _.mixin({
                      count: function(collection, predicate) {
                          if (!predicate) {
                              return collection.length;
                          }

                          var callback = _.iteratee(predicate);

                          return _.reduce(collection, function(result, item) {
                              return callback(item) ? result + 1 : result;
                          }, 0);
                      }
                  }, { chain: false });

                  var tasksComplete = _.count(tasks, {value:true});
                  var tasksTotal = _.count(tasks);

    if (flag == 'progress'){

        var percentComplete = Math.round((tasksComplete / tasksTotal) * 100);
        if(percentComplete == 100){
          return [percentComplete, 'tasks_complete'];
        }else{
          return [percentComplete, ''];
        }


    }else{

      if (tasksComplete == tasksTotal){

        return true;
      }else{
        return false;
      }
    }
}



function getFullJsonObj() {
  console.log('getFullJsonObj called');
    var dataSource = 'lists.json';
    // ORIGINAL -> jqueryNoConflict.getJSON(dataSource, renderDataVisualsTemplate);
    return jqueryNoConflict.getJSON(dataSource); // can do callback if desired ...getJSON(data, callback fn)
}



  function switchView(templateUrl, viewData){
    console.log('switchView called');
   var target = $("#content");
   $(target).empty().html("<img class='spinner' src='spinner.gif' />");
   $.ajax(templateUrl).done(function(data){
      //console.log(viewData);
       var template = Handlebars.compile(data);
       var html_data = template(viewData);
       //console.log(html_data);
       $(target).empty().html(html_data);
       let newHeight = Math.min($('html').height(), maxHeight);
       //console.log(newHeight);
       client.invoke('resize', { height: newHeight, width: '100%'});
   });


 }
 function formatDate(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0'+minutes : minutes;
  var strTime = hours + ':' + minutes + ' ' + ampm;
  return date.getMonth()+1 + "/" + date.getDate() + "/" + date.getFullYear() + " " + strTime;
}



}); //End Anonymous Function
