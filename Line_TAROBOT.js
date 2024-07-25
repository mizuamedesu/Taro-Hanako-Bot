const OPENAI_API_KEY = 'key';
const LINE_ACCESS_TOKEN = 'token';

function doPost(e) {
  const json = JSON.parse(e.postData.contents);
  const eventType = json.events[0].type;
  
  if (eventType !== "message") {
    return ContentService.createTextOutput(JSON.stringify({ 'result': 'ok' })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const sourceType = json.events[0].source.type;
  if (sourceType !== "user") {
    return ContentService.createTextOutput(JSON.stringify({ 'result': 'ok' })).setMimeType(ContentService.MimeType.JSON);
  }

  const replyToken = json.events[0].replyToken;
  const userId = json.events[0].source.userId;
  const userMessage = json.events[0].message.text;

  const count = incrementUserMessageCount(userId);
  const remainingCount = 15 - count;

  if (count <= 15) {
    const gptResponse = callGPT3(userMessage);

    if (gptResponse) {
      const replyMessage = gptResponse + `\n\n今日の残り返信回数: ${remainingCount}回`;
      replyToUser(replyToken, replyMessage);
    }
  } else {
    const errorMessage = "1日のメッセージ送信上限（15回）に達しました。明日以降、再度お試しください。";
    replyToUser(replyToken, errorMessage);
  }

  return ContentService.createTextOutput(JSON.stringify({ 'result': 'ok' })).setMimeType(ContentService.MimeType.JSON);
}


function incrementUserMessageCount(userId) {
  const userProperties = PropertiesService.getUserProperties();
  const lastResetDateKey = "lastResetDate";
  const currentDate = new Date().toISOString().slice(0, 10);

  const lastResetDate = userProperties.getProperty(lastResetDateKey);

  if (lastResetDate !== currentDate) {
    userProperties.deleteAllProperties();
    userProperties.setProperty(lastResetDateKey, currentDate);
  }

  const userCountKey = `count_${userId}`;
  let count = parseInt(userProperties.getProperty(userCountKey) || "0");
  count += 1;
  userProperties.setProperty(userCountKey, count.toString());

  return count;
}


function callGPT3(userMessage) {
  const apiEndpoint = 'https://api.openai.com/v1/chat/completions';
  const prompt = [
    {
      role: "system",
      content: "入力された文章を大学のセンター試験の太郎さんと花子さんが話しているようにしてください。文章はXです"
    },
    {
      role: "user",
      content: userMessage
    }
  ];

  const systemMessage = prompt[0].content.replace('X', userMessage);
    prompt[0].content = systemMessage;

  const data = {
    model: 'gpt-3.5-turbo',
    messages: prompt
  };

  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + OPENAI_API_KEY,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(data)
  };

  const response = UrlFetchApp.fetch(apiEndpoint, options);
  const jsonResponse = JSON.parse(response.getContentText());

  if (jsonResponse.choices && jsonResponse.choices.length > 0) {
    return jsonResponse.choices[0].message.content;
  }
  return null;
}

function replyToUser(replyToken, message) {
  const apiEndpoint = 'https://api.line.me/v2/bot/message/reply';
  const data = {
    replyToken: replyToken,
    messages: [
      {
        type: 'text',
        text: message
      }
    ]
  };

  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(data)
  };

  UrlFetchApp.fetch(apiEndpoint, options);
}
