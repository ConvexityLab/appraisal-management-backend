
import * as fs from 'fs';
import {
    encode,
    encodeChat,
    decode,
    isWithinTokenLimit,
    encodeGenerator,
    decodeGenerator,
    decodeAsyncGenerator,
    countTokens
  } from 'gpt-tokenizer'
  // note: depending on the model, import from the respective file, e.g.:
  // import {...} from 'gpt-tokenizer/model/gpt-4o'
//   import * as minify from '@node-minify/core';
//   import * as jsonminify  from '@node-minify/jsonminify';

import minify from "@node-minify/core";
import jsonminify from "@node-minify/jsonminify";

  //'prompt_test.txt'
//   /const text =    fs.readFileSync('Mismo_complete.json', 'utf8');
  const text =    fs.readFileSync('propmt.txt', 'utf8');
  const tokenLimit = 120000;
  const tokenCount = countTokens(text)

  minify({
    compressor: jsonminify,
    content: text, //JSON.parse(text),
    callback: (err, min) => {
        console.log("callback min");
        const tokenCount = countTokens(min)
        console.log(min);
    },
}).then((min) => {
    console.log("json min");
    console.log(min);
});
  
  // Encode text into tokens
 // const tokens = encode(text)
  
  // Decode tokens back into text
 // const decodedText = decode(tokens)
  
  // Check if text is within the token limit
  // returns false if the limit is exceeded, otherwise returns the actual number of tokens (truthy value)
 
  const withinTokenLimit = isWithinTokenLimit(text, tokenLimit)

console.log('Within Token Limit:', withinTokenLimit);

//minified 287728
// let your json freak flag fly = 384365 tokens

