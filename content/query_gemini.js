async function query_gemini(imageData){
    const fileManager = new GoogleAIFileManager("AIzaSyBTYpdXOyH6HiieXo4a0eTRAZe-u-BSy3E");
  
    const uploadResult = await fileManager.uploadFile(imageData, "image/png");
  
    const genAI = new GoogleGenerativeAI("AIzaSyBTYpdXOyH6HiieXo4a0eTRAZe-u-BSy3E");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const result = await model.generateContent([
      "Tell me about this image.",
      {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: uploadResult.file.mimeType,
        },
      },
    ]);
    
    return result;  // Explicitly return the result
  }