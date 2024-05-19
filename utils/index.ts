import fs from 'fs'

export const retrieveEnvVariable = (variableName: string) => {
  const variable = process.env[variableName] || '';
  if (!variable) {
    console.log(`${variableName} is not set`);
    process.exit(1);
  }
  return variable;
};

// Function to read JSON file
export function readJson(filename: string = "data.json"): string[] {
  if (!fs.existsSync(filename)) {
      // If the file does not exist, create an empty array
      fs.writeFileSync(filename, '[]', 'utf-8');
  }
  const data = fs.readFileSync(filename, 'utf-8');
  return JSON.parse(data)
}



export const saveDataToFile = (newData: string[], filePath: string = "data.json") => {
  try {
    let existingData: string[] = [];

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // If the file exists, read its content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      existingData = JSON.parse(fileContent);
    }

    // Add the new data to the existing array
    existingData.push(...newData);

    // Write the updated data back to the file
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

  } catch (error) {
    console.log('Error saving data to JSON file:', error);
  }
};