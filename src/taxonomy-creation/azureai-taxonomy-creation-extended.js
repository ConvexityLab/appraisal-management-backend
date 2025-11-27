import { AzureOpenAI } from "openai";
import dotenv from "dotenv";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import * as fs from 'fs';
import * as lancedb from "@lancedb/lancedb";
import ModelClient from "@azure-rest/ai-inference";

import { AzureKeyCredential } from "@azure/core-auth";

const modelClient = ModelClient( 
    "https://certo-open-ai.openai.azure.com/",
    new AzureKeyCredential('4eb228bf610d41efb3c9da939b16581b')
);

// const databaseDir = "./db/mismo-database";
// const db = await lancedb.connect(databaseDir);
// const tbl = await db.openTable("mismo");


//let writer = fs.createWriteStream('taxonomy-answers.json')  ;
//let writer2 = fs.createWriteStream('taxonomy-logic.json')  ;
dotenv.config();

import sections from '../data/taxonomy-eresi-chunks.json' with {type: 'json'};
const prompt = fs.readFileSync('./src/prompts/taxonomy-creation-prompt.txt', 'utf8');


let checklistArray = [];

let answers = [];


export async function main() {

  const endpoint = process.env["AZURE_OPENAI_ENDPOINT"] || "https://hiro-maq7gbb0-eastus2.openai.azure.com/"; // "https://certo-open-ai.openai.azure.com/";
  const apiKey = process.env["AZURE_OPENAI_API_KEY"] || "AJoVWAHdt1A90yDAtssUpwqcGiduJYNNxYFXKGnV1pWYhE5BSkgJJQQJ99BEACHYHv6XJ3w3AAAAACOG4q32"; //"4eb228bf610d41efb3c9da939b16581b";
  const apiVersion = "2025-01-01-preview"; 
  const deployment = "gpt-4.1"; //"one-lend-gpt-4o"; // This must match your deployment name

  const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

  let start = 0;
  let count = 2;

  //Transactions, Asset Assessment, General Property Eligibility, Underwriting Borrowers, Underwriting Property,
// "Liability Assessment"; 
// "Special Appraisal and Other Valuation Considerations"
// "Documentation Standards"; 
// "Liability Assessment" 
// "Texas Section 50(a)(6) Mortgage Loans" 
// "Insurance" 
  let sectionName = "Credit"  ; //;
  let fileName = sectionName.replace(' ','');

  const slectedSections = sections[sectionName];

  slectedSections.forEach(async element => {

  /* Create Prompts */

    let statement = `Break the following mortgage underwriting guideline section into a clear and comprehensive taxonomy. 
          -- The taxonomy should be structured in a way that allows for easy navigation and understanding of the underwriting criteria and requirements.
          -- This section of the taxonomy has a particular concept and it is ${JSON.stringify(sectionName)}.
          -- Restrict the output to only those sections that are relevant the overall taxonomic topic ${JSON.stringify(element.title)}.
          -- The taxonomy should be structured in a hierarchical manner, with each section representing a specific aspect of the underwriting guideline provided in the context.
          -- Each section should be broken down into sub-sections, with each sub-section representing a specific criterion or requirement.
          -- The taxonomy should be comprehensive and cover all aspects of the underwriting guideline provided in the context.
          -- The lower levels of the taxonomy should be detailed and specific, providing clear criteria and requirements for each aspect of the underwriting guideline.
          -- The levels of the taxonomy are going to be used to match with sematically the same or very similar sections of previously unseen guidelines from other lenders.
          -- The levels need to be structured in a way that allows for easy matching of sections from other lenders' guidelines.
          -- The levels need descriptiive names that are clear and unambiguous.
          -- The levels need to have accompanying descriptive language that aids in disambigiuating the levels and their criteria.

          Put your output into entirely in well-formed json format.
          Only output nested json to the level required by the section text and no more.
          The output should be a json object with the following structure:
          {
            "topic": "Eligibility",
            "Level 1 Name":
              {
                "level": 1,
                "referenceText": "Actual text from the underwriting guideline section",
                "description": "Description of Level 1",
                "Level 2 Name if necessary":
                  {
                    "level": 2,
                    "referenceText": "Actual text from the underwriting guideline section",
                    "description": "Description of Level 2"
                    "Level 3 Name if necessary":
                      {
                        "level": 3,
                        "referenceText": "Actual text from the underwriting guideline section",
                        "description": "Description of Level 3"
                      }
                  }
              }
          }
          Do not output any other text or characters other than the json output.
          Do not output any text that is not part of the json output.
          Do not  output leading text like the word json or any other words otehr than the json output.
          <GUIDELINE SECTION>
          ${element.text}
          </GUIDELINE SECTION>`;
          
    let messages = [
            { role: "system", content: "You are an AI that is expert at loan  underwriting and particularly taking sections of underwriting guidelines writen by lenders in order to completely and accurately describe the concepts and criteria required for the lender to offer a borrower a loan.  You are highly adept at distilling these sections into a well-formed, complete, comprehensive taxonomy.  You will be provided sections of an underwrting guideline in context and be expected to reason and generate output accurately and completely on each section.  You will also need to remmeber that each section will be included into a comprehensive taxonomy comprising the taxonomies of each section."  },
          { role: "user", content: statement }
          ];

    
  //  / let myjson = JSON.parse(stepsSchema);
    let result = await client.chat.completions.create({
        messages:  messages,
        // /response_format: { "type": "json_schema", "json_schema": {"name": stepsSchemaName, "schema": myjson}},
        // /max_tokens: 3000,
        max_completion_tokens: 5000,
        // temperature: 0.1,
        // top_p: 0.15,
        // frequency_penalty: 0,
        // presence_penalty: 0,
        // stop: null
      });
    
    result.choices[0].message.content = result.choices[0].message.content.replace(/```json\n?|```/g, ''); 
    try{
      let output = JSON.parse(result.choices[0].message.content);
      output["topic"] = sectionName ;
      fs.appendFileSync(`taxonomy-${fileName}-new.json`, JSON.stringify(output, null, 2) + ",\n",  'utf8');
    }
    catch (err) {
      console.error("Error parsing JSON:", err);
      console.error("Response content:", result.choices[0].message.content);
    }

  });
}

await main().catch((err) => {
  console.error("The sample encountered an error:", err);
});
