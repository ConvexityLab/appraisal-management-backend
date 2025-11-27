import * as fs from 'fs';
import ModelClient from "@azure-rest/ai-inference";
import { isUnexpected } from "@azure-rest/ai-inference";
//import { createSseStream } from "@azure/core-sse";
import { AzureKeyCredential } from "@azure/core-auth";
import { DefaultAzureCredential } from "@azure/identity";

import * as lancedb from "@lancedb/lancedb";
import * as arrow from "apache-arrow";


import fileNames from '../../yaml_to_text/filenames.json' with { type: "json" };


// const input = resolve(cwd(), file);

console.log('Starting directory: ' + process.cwd());
try {
  process.chdir('./yaml');
  console.log('New directory: ' + process.cwd());
}
catch (err) {
  console.log('chdir: ' + err);
}

const databaseDir = "./db";

const db = await lancedb.connect(databaseDir);

let mismo = [];

const client = ModelClient(
    
    //"https://certo-open-ai.openai.azure.com/openai/deployments/Embeddings1", 
    "https://certo-open-ai.openai.azure.com/",
    new AzureKeyCredential('4eb228bf610d41efb3c9da939b16581b')
);

let begin = 750;
let end = 751;

fs.readdirSync("../deref/yaml/").forEach(async (file) => {
    let name = file.split('.')[0]
    let slice = fileNames.slice(begin, end);
    if(slice.includes(name)) {
        
        try {
            const inputText = fs.readFileSync('../deref/yaml/' + file, 'utf8');
            
            var response = await client.path("/openai/deployments/Embeddings1/embeddings?api-version=2023-05-15").post({
                body: {
                    model: "text-embedding-ada-002",
                    input: [inputText],
                    input_type: "document"
                }
            });

            let vector = { 
                vector: response.body.data[0].embedding, 
                component: name 
            }
        //    / mismo.push(vector);

            fs.writeFileSync('../mismo_embeddings/' + name + '.json', JSON.stringify(vector), 'utf8');
        } catch (error) {
            console.error(`Error processing ${name}:`, error);  
        }
    }
});



// const _tbl = await db.createTable(
//     "mismo",
//     mismo,
//     { mode: "overwrite" },
//   );
  



// const clientOptions = { credentials: { "https://cognitiveservices.azure.com" } };

// const client = ModelClient(
//     "https://<resource>.services.ai.azure.com/models", 
//     new DefaultAzureCredential()
//     clientOptions,
// );





// if (isUnexpected(response)) {
//     throw response.body.error;
// }

// console.log(response.body.data[0].embedding);
// console.log(response.body.model);
// console.log(response.body.usage);





// var response = await client.path("/embeddings").post({
//     body: {
//         model: "text-embedding-ada-002",
//         input: ["The ultimate answer to the question of life"],
//         dimensions: 1024,
//     }
// });


// var response = await client.path("/embeddings").post({
//     body: {
//         model: "text-embedding-ada-002",
//         input: ["The answer to the ultimate question of life, the universe, and everything is 42"],
//         input_type: "document",
//     }
// });

// var response = await client.path("/embeddings").post({
//     body: {
//         model: "text-embedding-3-small",
//         input: ["What's the ultimate meaning of life?"],
//         input_type: "query",
//     }
// });