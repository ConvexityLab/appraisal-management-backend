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

const databaseDir = "./db/mismo-database";
const db = await lancedb.connect(databaseDir);
const tbl = await db.openTable("mismo");


//let writer = fs.createWriteStream('taxonomy-answers.json')  ;
//let writer2 = fs.createWriteStream('taxonomy-logic.json')  ;
dotenv.config();

import sections from '../data/doc-chunks-cleaned.json' with {type: 'json'};

const prompt = fs.readFileSync('./src/prompts/atomic-statement-prompt.txt', 'utf8');
const logicSchema = fs.readFileSync('./src/schemas/json-logic-schema.json', 'utf8');
const logicSchemaName = "LogicSchema"; 
const stepsSchema = fs.readFileSync('./src/schemas/steps-schema.json', 'utf8');
const stepsSchemaName = "StepsSchema"; 
const embelishmentSchema = fs.readFileSync('./src/schemas/json-logic-schema-field-embelishment.json', 'utf8');
const embelishmentSchemaName = "StepsSchema"; 

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
  
// /printNested( appraisalchecklist, "AppraisalReviewChecklist" );

let answers = [];


export async function main() {

 // endpoint = os.getenv("ENDPOINT_URL", "https://hiro-maq7gbb0-eastus2.openai.azure.com/")
 // deployment = os.getenv("DEPLOYMENT_NAME", "o4-mini-2")

  const endpoint = process.env["AZURE_OPENAI_ENDPOINT"] || "https://hiro-maq7gbb0-eastus2.openai.azure.com/"; // "https://certo-open-ai.openai.azure.com/";
  const apiKey = process.env["AZURE_OPENAI_API_KEY"] || "AJoVWAHdt1A90yDAtssUpwqcGiduJYNNxYFXKGnV1pWYhE5BSkgJJQQJ99BEACHYHv6XJ3w3AAAAACOG4q32"; //"4eb228bf610d41efb3c9da939b16581b";
  const apiVersion = "2025-01-01-preview"; 
  const deployment = "gpt-4.1"; //"one-lend-gpt-4o"; // This must match your deployment name

  const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

  let start = 0;
  let count = 2;

  const slectedSections = sections.slice(start, start + count);

  slectedSections.forEach(async element => {

    // /element =  sections[6];
    let topic = `This section referes to ${JSON.stringify(element.meta.headings)}.  The Section text is: ${element.text}`;

/* GET the embeddings for the Section text */
    var response = await modelClient.path("/openai/deployments/Embeddings1/embeddings?api-version=2023-05-15").post({
        body: {
            model: "text-embedding-ada-002",
            input: [topic],
            input_type: "document"
        }
    });

    const vectorResults = await tbl.search(response.body.data[0].embedding).limit(10).select(['component']).toArray();
    const mismoObjects = [...vectorResults].map((c) =>
        Object.keys(c).reduce(
            (acc, k) => (k ? { ...acc, [k]: `${c[k]}` } : acc),
            {} 
        )
    )
    
    let mismoSchemaText = '';
    let mismoSchemasUsed = [];
    
    mismoObjects.forEach((c) => {
      mismoSchemasUsed.push(c.component);
      mismoSchemaText += "<"+ c.component + ">\n\r" + fs.readFileSync('./deref/yaml/' + c.component + '.yaml', 'utf8');
      mismoSchemaText += "</"+ c.component + ">\n\r";
        //console.log(mismoSchemaText);
    });



/* Create Prompts */


    let statement = `Evaluate the statement \n\n<STATEMENT>${topic}</STATEMENT>\n\n by reasoning step by step using the instructions and exemplar provided.  
          Remember to break the statment into coherent, atomic statments that can easily be anyalyzed by an underwriter for accuracy and completness and turned into machine executable code. 
          1- Record each statement in the output as a separate, atomic statement.
          2- Include the data and any steps an analyst or underwriter would need to be able to evaluate the correctness of the statement.
          3- Include in your output: a name, description, your reasoning, data fields you used, the criteria for evaluation, steps and any notes or other considerations for each statement.
          3.a- Be sure to include each data field necessary for analyzing the criteria.
          3.b- If you find that there are criteria that require data that you cannot find suitable data fields in the MISMO schema and our extended data taxonomy for then make sure to note that.
          3.c- The data you determine are necessary and their source shoul dbe recorded together. If the source is not in the MISMO schema or our extended data taxonomy, but one that you decide you need but cannot find, note that fact along with the field.
          3.d- Include your reasoning for choosing each field and its data source.
          3.e- If you need to make assumptions, state them clearly.
        
          4- Use the MISMO data schema and our extended data taxonomy to identify the data fields you use in your analysis.
          5- Do not waste output characters on a summary or introduction, just get to the point.
          6- If the statement is not complete, identify the missing data and/or criteria needed to evaluate the statement.
          7- Be meticulous in your analysis and reasoning.
          8- If you need to make assumptions, state them clearly.
          9- Be absolutelty sure that the evaluation steps express clearly the data used and how the evaluation criteria are to be applied to the data fields. 
          10- Again: If the statement is not complete, identify the missing data and criteria needed to evaluate the statement.
          11- Be meticulous in your analysis and reasoning.
          12- If you need to make assumptions, state them clearly.`;
          // Respond in json format.  Use the json schema provided to format your response.
          // Identify the fields in the data set that you use to in your reasoning/analysis and meticulously identify 
          // each step needed to evaluate the criteria in the statement.  
          // If you need more data that is not currently present in the data set identify and state that fact. 
          // If the data set contains a field that you determine is needed for your analysis but the field is empty, 
          // report that fact.  If you think you need data that is likely available but in an external source, state that fact. `;
          
    let messages = [
            { role: "system", content: "You are an AI that is expert at loan  underwriting and particularly taking sections of underwrtign guidelines and distilling these sections into atomic statemenst, each of which is complete; meaning, it has the data and criteria and all of the data it needs to evaluate the criteris. The individual, atomic statements you distill from sections are capable of being evaluated.  You are an expert at mapping the data fields contained in these distinc, atomic statements you distill into MISMO compliant fields augmented by our database of additional canonical fields in the business data taxonomy"  },
            { role: "system", content: "Save the following MISMO Data Structures in your memory to use as the cononical reference for data fields to be acceptable for use in responses:  <MISMO DATA SCHEMAS> \n\n" + mismoSchemaText + "\n\n</MISMO DATA SCHEMAS>"},
            { role: "user", content: "Save the following instructions and exemplar in your memory for reference in answering the questions that follow:  <EXEMPLAR> \n\n" +  prompt + "\n\n</EXEMPLAR>"},
          { role: "user", content: statement }
          ];



    
    let myjson = JSON.parse(stepsSchema);
    let result = await client.chat.completions.create({
        messages:  messages,
        response_format: { "type": "json_schema", "json_schema": {"name": stepsSchemaName, "schema": myjson}},
        // /max_tokens: 3000,
        max_completion_tokens: 5000,
        // temperature: 0.1,
        // top_p: 0.15,
        // frequency_penalty: 0,
        // presence_penalty: 0,
        // stop: null
      });
    
 

    let output = JSON.parse(result.choices[0].message.content);
    messages.push({ role: "assistant", content: result.choices[0].message.content });
    messages.push({ role: "user", content: "Focus your attention and reasoning on the dataFieldsNotFound object.  These fields are ones that you have identified that are not found in the provided data schemas nor as far as you know in the braider taxonomy.  For each field identified in the dataFieldsNotFound object, Attempt to think of an alternative fields or set of feilds that could be created out more than one existing field in the taxonomy.  These fields, in combination could be used to provide that same information you identied as being required to satisfy the criteria." });
    myjson = JSON.parse(embelishmentSchema);
    result = await client.chat.completions.create({
        messages:  messages,
        response_format: { "type": "json_schema", "json_schema": {"name": embelishmentSchemaName, "schema": myjson}},
        max_completion_tokens: 5000,
      });
    

    let outputEmbellished = JSON.parse(result.choices[0].message.content);
    output["topic"] = element.meta.headings;
    output["text"] = element.text;
    output["refenceSchemas"] = mismoSchemasUsed;
    output["dataFieldsProposedAsSubstitutes"] = outputEmbellished["dataFieldsProposedAsSubstitutes"];
    //answers.push(output);
    fs.appendFileSync('taxonomy-answers-assets.json', JSON.stringify(output, null, 2) + ",\n",  'utf8');
    //writer.write(JSON.stringify(output, null, 2) + ",\n")



    messages.push({ role: "assistant", content: result.choices[0].message.content });
    messages.push({ role: "user", content: "Now, use all of the available information to check your work and when confident you are correct on field names and usage as well as criteria outlines, rewrite the steps in Json Logic format.  Be sure to be meticulous about your work.  Make sure you use only actual MISMO fields and document your logic. OVery very precise when using enumeration from enumerated fields.  Be sure to only use valid values for enumerated fields.  The valid value/entries are listed along with the field name and field description in the provided schema.  Do not make up or hallucinate field name nor enumerated values.  If you cannot find an appropriate enuration value in the ones listed with the field, simple make note of it in the notes section and a human will be notified that this step needs to be reviewed. " });
    myjson = JSON.parse(logicSchema);
    result = await client.chat.completions.create({
        messages:  messages,
        response_format: { "type": "json_schema", "json_schema": {"name": logicSchemaName, "schema": myjson}},
        max_completion_tokens: 5000,
      });

    output = JSON.parse(result.choices[0].message.content);
    output["topic"] = element.meta.headings;
    output["text"] = element.text;
    output["meta"] = element.meta;
    output["refenceSchemas"] = mismoSchemasUsed;
    //answers.push(output);
    fs.appendFileSync('taxonomy-logic-assets.json', JSON.stringify(output, null, 2) + ",\n", 'utf8');
    //writer2.write(JSON.stringify(output, null, 2) + ",\n")

  });
}

await main().catch((err) => {
  console.error("The sample encountered an error:", err);
});
