import getBase64Image from "./utils/base64_imageConverter.js";

async function query(data) {
  const response = await fetch(
    "http://localhost:3000/api/v1/prediction/6b41eae7-02c7-44ed-b947-a043fba9d72e",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );
  const result = await response.json();
  return result;
}

query({
  question:
    "Can you only give me the plate number of the car? (no other informations or words)",
  uploads: [
    {
      data: await getBase64Image("img/car4.png"), //base64 string or url
      type: "file", //file | url
      name: "p1.png",
      mime: "image/png",
    },
  ],
}).then((response) => {
  const plateNumber = response.text.trim(); // Remove newline characters
  console.log(plateNumber); // This will log the plate number without any newline
});
