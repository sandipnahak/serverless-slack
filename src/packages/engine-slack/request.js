/* @flow */
import type { Slack$Payloads } from 'types/slack';
import type { AWS$Secrets$Slack } from 'types/secrets';

import axios from 'axios';

import bot from 'bot';

let requester;

function createRequester() {
  const { slackSecrets }: { slackSecrets: AWS$Secrets$Slack } = bot.state.config.state;
  // we need to do this so we can have access to the
  // secrets on the first request
  return axios.create({
    baseURL: 'https://slack.com/api',
    headers: {
      'User-Agent': 'serverless-slack',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${slackSecrets.oauth_token}`,
    },
  });
}
/**
 * OK Check for Responses
 *
 * @param {object} response - The API response to check
 * @return {Promise} A promise with the API response
 */
async function getData(response) {
  const { status, data, statusText } = response;
  console.log('Get Data: ', statusText, data);
  if ((status >= 200 && status < 400) || statusText.toLowerCase() === 'ok') {
    return data;
  }
  throw new Error(JSON.stringify(data));
}

function handleError(err, body?: Slack$Payloads) {
  console.error('----------------------------');
  console.error('An Error Occurred While Calling the Slack API');
  console.log('Request: ', body);
  console.log('Error: ', err);

  if (err.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.error(err.response.data);
    console.error(err.response.status);
    console.error(err.response.headers);
  } else if (err.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    console.error(err.request);
  } else {
    // Something happened in setting up the request that triggered an Error
  }
  console.error('----------------------------');

  if (body && body.response_url) {
    let msg;
    if (err.message) {
      console.log('error.message');
      const result = JSON.parse(err.message);
      [msg] = result.response_metadata.messages;
    } else if (err.error) {
      console.log('error.error');
      msg = err.error;
    } else {
      msg = 'Unknown Error Occurred During Slack API Request';
    }
    return rawRequest(body.response_url, {
      text: msg,
    });
  }

  throw new Error(err.message);
}

export function rawRequest(url: string, data: Object) {
  return axios
    .post(url, data)
    .then(getData)
    .catch(handleError);
}

export function request(method: string, data: Object, body?: Slack$Payloads) {
  if (!requester) {
    requester = createRequester();
  }
  return requester
    .post(method, data)
    .then(getData)
    .catch(e => handleError(e, body));
}

export function getRequest(method: string, params: Object) {
  const { slackSecrets }: { slackSecrets: AWS$Secrets$Slack } = bot.state.config.state;

  return axios({
    method: 'get',
    url: method,
    baseURL: 'https://slack.com/api',
    params: {
      ...params,
      token: slackSecrets.oauth_token,
    },
    headers: {
      'User-Agent': 'serverless-slack',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
    .then(getData)
    .catch(handleError);
}

export function customRequest(method: string, settings: Object) {
  const { slackSecrets }: { slackSecrets: AWS$Secrets$Slack } = bot.state.config.state;

  return axios({
    url: method,
    baseURL: 'https://slack.com/api',
    ...settings,
    headers: {
      'User-Agent': 'serverless-slack',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${slackSecrets.oauth_token}`,
      ...settings.headers,
    },
  })
    .then(getData)
    .catch(handleError);
}
