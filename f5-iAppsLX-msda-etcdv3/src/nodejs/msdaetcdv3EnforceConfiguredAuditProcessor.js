/*
  Copyright (c) 2017, F5 Networks, Inc.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
  *
  http://www.apache.org/licenses/LICENSE-2.0
  *
  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied. See the License for the specific
  language governing permissions and limitations under the License.

  Updated by Ping Xiong on May/13/2022
  Updated by Ping Xiong on Oct/09/2022, modify the polling signal into a json object to keep more information.
  let blockInstance = {
    name: "instanceName", // a block instance of the iapplx config
    state: "polling", // can be "polling" for normal running state; "update" to modify the iapplx config
    bigipPool: "/Common/samplePool"
  }
*/

'use strict';


//var q = require("q");

var blockUtil = require("./blockUtils");
var logger = require("f5-logger").getInstance();
//var fs = require('fs');

// Setup a signal for onpolling status. It has an initial state "false".
//const msdaetcdv3OnPollingSignal = '/var/tmp/msdaetcdv3OnPolling';
//var msdaOnPolling = false;


function msdaetcdv3EnforceConfiguredAuditProcessor() {
    // you can also use this.logger on a RestWorker
    // Using directly from require (below) is another way to call log events
    logger.info("loading msdaetcdv3 Enforce Configured Audit Processor");
}

// For logging, show the number of the audit cycle. Increments on each new "turn" of the auditor
var entryCounter = 0;

var getLogHeader = function () {
    return "AUDIT #" + entryCounter + ": ";
};


msdaetcdv3EnforceConfiguredAuditProcessor.prototype.WORKER_URI_PATH = "shared/iapp/processors/msdaetcdv3EnforceConfiguredAudit";

msdaetcdv3EnforceConfiguredAuditProcessor.prototype.onStart = function (success) {
    logger.fine("msdaetcdv3EnforceConfiguredAuditProcessor.prototype.onStart");
    //logger.fine("MSDA etcdv3 audit onStart: ConfigProcessor polling state: ");
    this.apiStatus = this.API_STATUS.INTERNAL_ONLY;
    this.isPublic = true;
 
/*
    icr.initialize( {
        restOperationFactory: this.restOperationFactory,
        restHelper: this.restHelper,
        wellKnownPorts: this.wellKnownPorts,
        referrer: this.referrer,
        restRequestSender: this.restRequestSender
    });
*/
    success();
};


// The incoming restOperation contains the current Block.
// Populate auditTaskState.currentInputProperties with the values on the device.
// In ENFORCE_CONFIGURED, ignore the found configuration is on the BigIP.
msdaetcdv3EnforceConfiguredAuditProcessor.prototype.onPost = function (restOperation) {
    entryCounter++;
    logger.fine(getLogHeader() + "MSDA Audit onPost: START");
    var oThis = this;
    var auditTaskState = restOperation.getBody();

    setTimeout(function () {
      try {
        if (!auditTaskState) {
          throw new Error("AUDIT: Audit task state must exist ");
        }
        /*
            logger.fine(getLogHeader() + "Incoming properties: " +
                this.restHelper.jsonPrinter(auditTaskState.currentInputProperties));
        */

        var blockInputProperties = blockUtil.getMapFromPropertiesAndValidate(
          auditTaskState.currentInputProperties,
          [
            //"etcdv3Endpoint",
            //"authenticationCert",
            //"nameSpace",
            //"serviceName",
            "poolName",
            "poolType",
            "healthMonitor",
          ]
        );

        // Check the polling state, trigger ConfigProcessor if needed.
        // Move the signal checking here
        logger.fine("MSDA etcdv3 Audit: msdaetcdv3Onpolling: ", global.msdaetcdv3OnPolling);
        logger.fine("MSDA etcdv3 Audit: msdaetcdv3 poolName: ", blockInputProperties.poolName.value);
        if (
          global.msdaetcdv3OnPolling.some(
            (instance) =>
              instance.bigipPool === blockInputProperties.poolName.value
          )
        ) {
          logger.fine(
            "MSDA etcdv3 audit onPost: ConfigProcessor is on polling state, no need to fire an onPost.",
            blockInputProperties.poolName.value
          );
        } else {
          logger.fine(
            "MSDA etcdv3 audit onPost: ConfigProcessor is NOT on polling state, will trigger ConfigProcessor onPost.",
            blockInputProperties.poolName.value
          );
          try {
            var poolNameObject = getObjectByID(
              "poolName",
              auditTaskState.currentInputProperties
            );
            poolNameObject.value = null;
            oThis.finishOperation(restOperation, auditTaskState);
            logger.fine(
              "MSDA etcdv3 audit onPost: trigger ConfigProcessor onPost "
            );
          } catch (err) {
            logger.fine(
              "MSDA etcdv3 audit onPost: Failed to send out restOperation. ",
              err.message
            );
          }
        }
      } catch (ex) {
        logger.fine(
          "msdaetcdv3EnforceConfiguredAuditProcessor.prototype.onPost caught generic exception " +
            ex
        );
        restOperation.fail(ex);
      }
    }, 2000);
};

var getObjectByID = function ( key, array) {
    var foundItArray = array.filter( function( item ) {
        return item.id === key;
    });
    return foundItArray[0];
};

msdaetcdv3EnforceConfiguredAuditProcessor.prototype.finishOperation = function( restOperation, auditTaskState ) {
    restOperation.setBody(auditTaskState);
    this.completeRestOperation(restOperation);
    logger.fine(getLogHeader() + "DONE" );
};

module.exports = msdaetcdv3EnforceConfiguredAuditProcessor;
