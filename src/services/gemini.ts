import { GoogleGenAI, Type } from "@google/genai";
import { Lecture, Question } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const MODEL_NAME = "gemini-3-flash-preview";

export const geminiService = {
  async generateLecture(documentContent: string): Promise<Lecture> {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Bạn là một chuyên gia sư phạm Tin học cao cấp. Dựa trên tài liệu sau, hãy soạn một bài giảng cực kỳ chi tiết, chuyên sâu, dễ hiểu và có tính ứng dụng cao cho sinh viên.
      
      Yêu cầu cấu trúc bài giảng (Phải trình bày bằng tiếng Việt):
      1. Tiêu đề: Phải chuyên nghiệp và bao quát nội dung.
      2. Mục tiêu bài học: Liệt kê ít nhất 4-5 mục tiêu cụ thể (Kiến thức, Kỹ năng, Thái độ).
      3. Nội dung chính: 
         - Trình bày cực kỳ chi tiết, logic, chia thành các đề mục rõ ràng.
         - Sử dụng Markdown triệt để: **in đậm** các thuật ngữ quan trọng, *in nghiêng* các lưu ý, sử dụng danh sách, bảng so sánh nếu cần.
         - Giải thích các khái niệm kỹ thuật bằng các ví dụ đời thường để sinh viên dễ hình dung.
         - Phân tích sâu các khía cạnh của vấn đề, không chỉ liệt kê.
      4. Ví dụ minh họa: Đưa ra ít nhất 3-5 ví dụ thực tế, đoạn mã mẫu (nếu là lập trình) hoặc các tình huống giải quyết vấn đề cụ thể. Mỗi ví dụ phải có phần phân tích tại sao lại làm như vậy.
      5. Kết luận & Tóm tắt: Tổng hợp lại các kiến thức cốt lõi nhất một cách súc tích nhưng đầy đủ.

      Tài liệu nguồn: ${documentContent}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            mainContent: { type: Type.STRING, description: "Nội dung chi tiết bài giảng sử dụng Markdown, trình bày chuyên sâu" },
            examples: { type: Type.ARRAY, items: { type: Type.STRING } },
            conclusion: { type: Type.STRING },
          },
          required: ["title", "objectives", "mainContent", "examples", "conclusion"],
        },
      },
    });

    const text = response.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  },

  async answerQuestion(documentContent: string, question: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Bạn là một Trợ lý Gia sư Tin học. Chỉ trả lời dựa trên tài liệu sau. Nếu thông tin không có trong tài liệu, hãy thông báo lịch sự rằng "Thông tin này nằm ngoài phạm vi bài học".
      
      Tài liệu: ${documentContent}
      
      Câu hỏi: ${question}`,
    });

    return response.text || "Xin lỗi, tôi không thể trả lời câu hỏi này.";
  },

  async generateTest(documentContent: string): Promise<Question[]> {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Dựa trên tài liệu sau, hãy tạo 5 câu hỏi trắc nghiệm (MCQ). Mỗi câu hỏi có 4 lựa chọn và 1 đáp án đúng. Kèm theo giải thích chi tiết.
      
      Tài liệu: ${documentContent}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
            },
            required: ["id", "question", "options", "correctAnswer", "explanation"],
          },
        },
      },
    });

    const text = response.text || "[]";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  },

  async generateFeedback(score: number, total: number, errors: any[], studentName: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Hãy viết một nhận xét cá nhân hóa cho sinh viên ${studentName} vừa hoàn thành bài kiểm tra với điểm số ${score}/${total}.
      Các lỗi sai cụ thể: ${JSON.stringify(errors)}
      
      Yêu cầu:
      - Phong cách sư phạm, khích lệ.
      - Phải dựa trên lỗi sai cụ thể để đưa ra lời khuyên.
      - Không được giống hệt các nhận xét mẫu.`,
    });

    return response.text || "Em đã hoàn thành bài kiểm tra. Hãy tiếp tục cố gắng nhé!";
  }
};
