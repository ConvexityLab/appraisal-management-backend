import { AzureOpenAI } from "openai";
import dotenv from "dotenv";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import * as fs from 'fs';
let writer = fs.createWriteStream('uad-answers.json')  ;
dotenv.config();

import appraisalchecklist from '../../xml/appraisal-review-master-checklist.json' with {type: 'json'};

const prompt = fs.readFileSync('xml/UAD3.6-example.xml', 'utf8');
const outputSchema = fs.readFileSync('schemas/test-schema.json', 'utf8');

let checklistArray = [];


function printNested(obj, parentKey = '') {
    if (typeof obj === 'object' && !Array.isArray(obj) && obj !== null) {
        for (let key in obj) {
            printNested(obj[key], parentKey + "." + key);
        }
    } else {
        if (Array.isArray(obj)) {
            obj.forEach(element => {
                checklistArray.push("Topic: "+ parentKey + "  criteria: " + element);
            });
        }
        else {
            checklistArray.push("Topic: "+ parentKey + "  criteria: " + obj);
        }
  }
}
  
  printNested( appraisalchecklist, "AppraisalReviewChecklist" );


export async function main() {
  // You will need to set these environment variables or edit the following values
//   const endpoint = process.env["AZURE_OPENAI_ENDPOINT"] || "https://certo-open-ai.openai.azure.com/";
//   const apiVersion = "2025-01-01-preview";
//   const deployment = "one-lend-gpt-4o"; // This must match your deployment name

//   // Initialize the DefaultAzureCredential
//   const credential = new DefaultAzureCredential();
//   const scope = "https://cognitiveservices.azure.com/.default";
//   const azureADTokenProvider = getBearerTokenProvider(credential, scope);


  const endpoint = process.env["AZURE_OPENAI_ENDPOINT"] || "https://certo-open-ai.openai.azure.com/";
  const apiKey = process.env["AZURE_OPENAI_API_KEY"] || "4eb228bf610d41efb3c9da939b16581b";
  const apiVersion = "2025-01-01-preview";
  const deployment = "one-lend-gpt-4o"; // This must match your deployment name

  const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });


  // Initialize the AzureOpenAI client with Entra ID (Azure AD) authentication
//   /const client = new AzureOpenAI({ endpoint, azureADTokenProvider, apiVersion, deployment });

  const messages = [
    { role: "system", content: "You are an AI that is expert at loan and appraisal underwriting and particularly mapping fields in appraisal review checklists, criteria and guidelines to canonical fields in the business data taxonomy"  },
    { role: "system", content: "Save the following data schema in your mememory for reference in answering the questions that follow:  <DATA SCHEMA> \n\n" +  prompt + "\n\n</DATA SCHEMA>"},

  ];


//   const result = await client.chat.completions.create({
//     messages: messages ,
//     // [
//     //   { role: "system", content: "You are an AI that is expert at loan underwriting and particularly mapping fields in mortgage underwriting guidelines to canonical fields in the business data taxonomy" }
//     // ],
//     max_tokens: 3000,
//     temperature: 0.1,
//     top_p: 0.15,
//     frequency_penalty: 0,
//     presence_penalty: 0,
//     stop: null
//   });

  let answers = [];

  let count = 1;

  checklistArray.forEach(async element => {
    if( count-- < 0) {
        return;
    }
    let statement = `Evaluate the statement \n\n<STATEMENT>${element}</STATEMENT>\n\n by reasoning step by step using the data provided in the UAD 3.6 above.  
          respond in json format.  Use the json schema provided to format your response.
          Identify the fields in the data set that you use to in your reasoning/analysis and meticulously identify 
          each step needed to evaluate the criteria in the statement.  
          If you need more data that is not currently present in the data set identify and state that fact. 
          If the data set contains a field that you determine is needed for your analysis but the field is empty, 
          report that fact.  If you think you need data that is likely available but in an external source, state that fact. `;
    const messages = [
      { role: "system", content: "You are an AI that is expert at loan and appraisal underwriting and particularly mapping fields in appraisal review checklists, criteria and guidelines to canonical fields in the business data taxonomy"  },
      { role: "system", content: "Save the following data schema in your mememory for reference in answering the questions that follow:  <DATA SCHEMA> \n\n" +  prompt + "\n\n</DATA SCHEMA>"},
  
        { role: "user", content: statement }
      ];
    
    const myjson = JSON.parse(outputSchema);
    const result = await client.chat.completions.create({
        messages:  messages,
        response_format: { "type": "json_schema", "json_schema": myjson },
        max_tokens: 3000,
        temperature: 0.1,
        top_p: 0.15,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: null
      });
    answers.push(result.choices[0].message.content);
    writer.write(result.choices[0].message.content);
  });
}

main().catch((err) => {
  console.error("The sample encountered an error:", err);
});
