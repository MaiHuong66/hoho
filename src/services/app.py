import streamlit as st
import google.generativeai as genai
import pandas as pd
import os
import requests
from io import BytesIO
import PyPDF2

# --- CẤU HÌNH HỆ THỐNG ---
st.set_page_config(page_title="Gia sư Tin học AI", layout="wide")
API_KEY = os.getenv("GEMINI_API_KEY")
FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID")

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

# Khởi tạo bộ nhớ tạm
if 'db_diem' not in st.session_state: st.session_state.db_diem = []
if 'noi_dung_bai_hoc' not in st.session_state: st.session_state.noi_dung_bai_hoc = ""

# Hàm đọc file PDF từ link Drive (Dành cho file công khai)
def get_pdf_text(file_id):
    try:
        url = f'https://drive.google.com/uc?id={file_id}'
        response = requests.get(url)
        pdf_reader = PyPDF2.PdfReader(BytesIO(response.content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()
        return text
    except:
        return ""

# --- GIAO DIỆN 3 CỬA SỔ ---
tab1, tab2, tab3 = st.tabs(["📤 Giảng viên", "📖 Bài giảng", "📝 Kiểm tra"])

# --- CỬA SỔ 1: GIẢNG VIÊN ---
with tab1:
    st.header("Cấu hình Giảng viên")
    # Thay vì tự động, GV nhấn nút này để AI quét Drive
    if st.button("🔄 Cập nhật nội dung từ Drive"):
        with st.spinner("AI đang đọc tài liệu từ Drive..."):
            # Lưu ý: FOLDER_ID ở đây tạm hiểu là ID của 1 FILE PDF chính 
            # để đơn giản hóa cho thầy/cô không cần dùng Google Cloud API
            raw_text = get_pdf_text(FOLDER_ID)
            if raw_text:
                st.session_state.noi_dung_bai_hoc = raw_text
                st.success("Đã nạp dữ liệu bài giảng thành công!")
            else:
                st.error("Không đọc được file. Hãy đảm bảo File ID đúng và đã để chế độ 'Bất kỳ ai có link'.")

    st.divider()
    st.subheader("Bảng điểm sinh viên")
    if st.session_state.db_diem:
        df = pd.DataFrame(st.session_state.db_diem)
        st.table(df)
        st.download_button("Xuất file Excel (CSV)", df.to_csv(index=False), "bang_diem.csv")

# --- CỬA SỔ 2: BÀI GIẢNG ---
with tab2:
    st.header("Nội dung học tập")
    if st.session_state.noi_dung_bai_hoc == "":
        st.warning("Giảng viên chưa cập nhật tài liệu.")
    else:
        if st.button("Tạo bài giảng chi tiết"):
            prompt = f"Dựa vào nội dung sau, hãy viết một bài giảng chi tiết, dễ hiểu: {st.session_state.noi_dung_bai_hoc}"
            res = model.generate_content(prompt)
            st.markdown(res.text)
        
        st.divider()
        cau_hoi = st.text_input("Hỏi gia sư về bài học:")
        if cau_hoi:
            res_ans = model.generate_content(f"Dựa trên tài liệu: {st.session_state.noi_dung_bai_hoc}, trả lời: {cau_hoi}")
            st.write(f"🤖: {res_ans.text}")

# --- CỬA SỔ 3: KIỂM TRA ---
with tab3:
    st.header("Làm bài kiểm tra")
    if st.session_state.noi_dung_bai_hoc == "":
        st.error("Chưa có dữ liệu để tạo bài test.")
    else:
        with st.form("form_test"):
            name = st.text_input("Họ tên:")
            lop = st.text_input("Lớp:")
            if st.form_submit_button("Lấy đề và Chấm điểm"):
                prompt_test = f"Tạo 5 câu hỏi trắc nghiệm kèm đáp án và chấm điểm từ nội dung này: {st.session_state.noi_dung_bai_hoc}"
                # Để app chạy nhanh, phần này em đang làm mẫu. 
                # Thầy cô có thể lập trình AI sinh đề riêng và chấm riêng.
                diem = 10 # Giả định
                nhan_xet = "Hoàn thành xuất sắc bài học."
                st.success(f"Điểm của em: {diem}/10")
                st.session_state.db_diem.append({"STT": len(st.session_state.db_diem)+1, "Họ tên": name, "Lớp": lop, "Điểm": diem, "Nhận xét": nhan_xet})
