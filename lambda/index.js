const Alexa = require('ask-sdk-core');
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');
const https = require('follow-redirects').https;

const validThreshold = 0.7;
const maxValidTime = 60*60*24*2 - 1; // time in seconds -> 47:59:59 max 
const minValidTime = 60;             // time in seconds -> 0:01:00 min

// contains the information for the next test station for a given postal code
const nextStations = new Map([
  ["4501", 'im Forum Neuhofen an der Krems'],
  ["4060", 'in der Sporthalle Leonding'],
  ["4050", 'im Volkshaus Traun'],
  ["4030", 'im Volkshaus Ebelsberg'],
  ["4470", 'in der Stadthalle Enns']
]);



// Function to return the country and postal code of the device using this skill
const getHttp = function(device, token) {
    return new Promise((resolve, reject) => {
            const options = {
              'method': 'GET',
              'hostname': 'api.eu.amazonalexa.com',
              'path': `/v1/devices/${device}/settings/address/countryAndPostalCode`,
              'headers': {
                'Authorization': `Bearer ${token}`
              },
              'maxRedirects': 20
            };
        
        const request = https.request(options, response => {
            response.setEncoding('utf8');
            console.log("response: " +  response.headers.location);
            
            let returnData = '';
            if (response.statusCode < 200 || response.statusCode >= 300) {
                console.log("getHttp error:" + response.statusCode);
                return reject(new Error(`${response.statusCode}: ${response.req.getHeader('host')} ${response.req.path}`));
            }
           
            response.on('data', chunk => {
                returnData += chunk;
            });
           
            response.on('end', () => {
                resolve(returnData);
            });
           
            response.on('error', error => {
                reject(error);
            });
        });
        request.end();
    });
}



/* INTENT HANDLERS */
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    const speakOutput = requestAttributes.t('WELCOME_MESSAGE', requestAttributes.t('SKILL_NAME'));
    const repromptOutput = requestAttributes.t('WELCOME_REPROMPT');

    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(repromptOutput)
      .getResponse();
  },
};

// handle request dealing with the validity  of the "saved" corona test
const CoronaTestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'ValideIndent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    let cardTitle = requestAttributes.t('DISPLAY_CARD_TITLE_INVALID');
    let speakOutput = '';
    
    // test is still valid ?
    if(Math.random() < validThreshold){
        // is still valid
        let sec = Math.floor(Math.random() * (maxValidTime - minValidTime + 1) + minValidTime);
        cardTitle = requestAttributes.t('DISPLAY_CARD_TITLE_VALID');
       
        let hours   = Math.floor(sec / 3600); // get hours
        let minutes = Math.floor((sec - (hours * 3600)) / 60); // get minutes
        let seconds = sec - (hours * 3600) - (minutes * 60); //  get seconds

        speakOutput = requestAttributes.t('MESSAGE_VALID_TEST', hours > 0 ? hours + " Stunden und" : "", minutes);
        
        handlerInput.responseBuilder
            .speak(speakOutput)
            .withSimpleCard(cardTitle, speakOutput)
    }
    else{
        speakOutput = requestAttributes.t('MESSAGE_INVALID_TEST');
        handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(sessionAttributes.repromptSpeech)
            .withSimpleCard(cardTitle, speakOutput)
    }    

      return handlerInput.responseBuilder.getResponse();
    }
};


// get next station for tests
const NextStationHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'NextStation';
      
  },
  async handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const cardTitle = requestAttributes.t('DISPLAY_CARD_TITLE_TESTSTREET');
   
    // get deviceId and apiAccessToken to access alexa endpoints returning needed postalCode and country
    const tokenID = handlerInput.requestEnvelope.context.System.apiAccessToken;
    const deviceID = handlerInput.requestEnvelope.context.System.device.deviceId;
    let speakOutput = requestAttributes.t('NEXT_STATION_MSG_INVALID');

     try {
        const response = await getHttp(deviceID, tokenID);
        console.log(JSON.parse(response));
        const res = JSON.parse(response);
        
        if(nextStations.get(res.postalCode) !== undefined){
            speakOutput = requestAttributes.t('NEXT_STATION_MSG',nextStations.get(res.postalCode));
        }
        else{
            speakOutput = requestAttributes.t('NEXT_STATION_NOT_FOUND');
        }
        handlerInput.responseBuilder
            .speak(speakOutput)
            .withSimpleCard(cardTitle, speakOutput)
           
    } catch(error) {
        speakOutput = requestAttributes.t('NEXT_STATION_MSG_INVALID');
        console.log("ERROR NextStationHandler:" + error);
        handlerInput.responseBuilder
            .speak(speakOutput)
    }
   
    return handlerInput.responseBuilder
        .getResponse();
  }
};




const HelpHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();


    sessionAttributes.speakOutput = requestAttributes.t('HELP_MESSAGE');
    sessionAttributes.repromptSpeech = requestAttributes.t('HELP_REPROMPT');
    return handlerInput.responseBuilder
      .speak(sessionAttributes.speakOutput)
      .reprompt(sessionAttributes.repromptSpeech)
      .getResponse();
  },
};

const RepeatHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    return handlerInput.responseBuilder
      .speak(sessionAttributes.speakOutput)
      .reprompt(sessionAttributes.repromptSpeech)
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent');
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speakOutput = requestAttributes.t('STOP_MESSAGE', requestAttributes.t('SKILL_NAME'));

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    console.log('Inside SessionEndedRequestHandler');
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${JSON.stringify(handlerInput.requestEnvelope)}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);
    
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const msg = requestAttributes.t('INVALID_COMMANT');
    return handlerInput.responseBuilder
      .speak(msg)
      .reprompt(msg)
      .getResponse();
  },
};

/* Helper Functions */

// Finding the locale of the user
const LocalizationInterceptor = {
  process(handlerInput) {
    const localizationClient = i18n.use(sprintf).init({
      lng: handlerInput.requestEnvelope.request.locale,
      overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
      resources: languageStrings,
      returnObjects: true,
    });

    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function (...args) {
      return localizationClient.t(...args);
    };
  },
};


/* LAMBDA SETUP */
const skillBuilder = Alexa.SkillBuilders.custom();
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    CoronaTestHandler,
    NextStationHandler,
    HelpHandler,
    RepeatHandler,
    ExitHandler,
    SessionEndedRequestHandler,
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent('sample/hello-world/v1.2')
  .lambda();
    
    
const languageStrings = {
  'de': {
    translation: {
      SKILL_NAME: 'Alexa Skill für Corona Test',
      WELCOME_MESSAGE: 'Willkommen bei %s. Du kannst beispielsweise die Frage stellen:  Ist mein Test noch gültig? ... Nun, womit kann ich dir helfen?',
      WELCOME_REPROMPT: 'Wenn du wissen möchtest, was du sagen kannst, sag einfach „Hilf mir“.',
      HELP_MESSAGE: 'Du kannst beispielsweise Fragen stellen wie „Ist mein Test noch gültig“ oder du kannst „Beenden“ sagen ... Wie kann ich dir helfen?',
      HELP_REPROMPT: 'Du kannst beispielsweise Sachen sagen wie „Ist mein Test noch gültig“ oder du kannst „Beenden“ sagen ... Wie kann ich dir helfen?',
      STOP_MESSAGE: 'Auf Wiedersehen!',
      REPEAT_MESSAGE: 'Sage einfach „Wiederholen“.',
      DISPLAY_CARD_TITLE_VALID: "Restdauer des Corona Tests",
      DISPLAY_CARD_TITLE_INVALID:"Corona Test Abgelaufen",
      DISPLAY_CARD_TITLE_TESTSTREET:"Nächste Teststraße",
      MESSAGE_VALID_TEST:"Dein Corona Test ist noch %s %s Minuten gültig",
      INVALID_COMMANT:"Entschuldigung, ich kenne diesen Befehl nicht. Bitte versuche es erneut",
      MESSAGE_INVALID_TEST:"Dein Corona Test ist nicht mehr Gültig. Möchtest du den Standort für die nächste Teststrasse wissen?",
      NEXT_STATION_MSG_INVALID: 'Ich konnte deine Position nicht bestimmen',
      NEXT_STATION_MSG: 'Die nächste Teststraße ist %s',
      NEXT_STATION_NOT_FOUND: 'Ich könnte die näcshte Testraße nicht bestimmen.'
    },
  },
};