"use strict";

const { get } = require('axios')

class Handler {
  constructor({ rekoSvc, translatorSvc }) {
    this.rekoSvc = rekoSvc;
    this.translatorSvc = translatorSvc;
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters
      const buffer = await this.getImageBuffer(imageUrl)
      const { names, workingItems } = await this.detecimagesLabels(buffer)

      return this.formatResponse(200, this.formatTextResults(names, workingItems));
    } catch (error) {
      console.log('Error***', error);
      return this.formatResponse(500, 'Internal server error!');
    }
  }

  async detecimagesLabels(buffer) {
    const result = await this.rekoSvc.detectLabels({
      Image: { Bytes: buffer }
    }).promise();

    const workingItems = result.Labels.filter(({ Confidence }) => Confidence > 90);

    const names = workingItems.map(({ Name }) => Name).join(' and ')
    const namesInPortuguese = await this.translateText(names)

    return { names: namesInPortuguese, workingItems }
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text
    }

    const { TranslatedText } = await this.translatorSvc.translateText(params).promise();

    return TranslatedText.split(' e ')
  }

  async getImageBuffer(imageUrl) {
    const response = await get(imageUrl, {
      responseType: 'arraybuffer'
    })

    const buffer = Buffer.from(response.data, 'base64')

    return buffer;
  }

  formatResponse(statusCode, body) {
    return { statusCode, body };
  }

  formatTextResults(texts, workingItems) {
    const finalText = []

    for (const indexText in texts) {
      const nameInPortuguese = texts[indexText]
      const confidence = workingItems[indexText]['Confidence']

      finalText.push(
        `${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`
      )
    }

    return finalText.join('\n')
  }

}

const aws = require('aws-sdk');
const reko = new aws.Rekognition();
const translator = new aws.Translate()
const handler = new Handler({
  rekoSvc: reko, translatorSvc: translator
});

module.exports.main = handler.main.bind(handler)
