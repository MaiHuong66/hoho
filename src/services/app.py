import streamlit as st
import google.generativeai as genai
import pandas as pd
import os

# --- CẤU HÌNH CỐ ĐỊNH (CÁCH 2) ---
# Thầy/cô dán ID thư mục Google Drive của thầy/cô vào đây
FIXED_FOLDER_ID = "1n-8HySBGZe9UY3eKONZWtfMZbKam6pys" 

# THẦY/CÔ COPY NỘI DUNG VĂN BẢN CỦA FILE PDF RỒI DÁN VÀO GIỮA HAI DẤU NAY """ ... """
NOI_DUNG_BAI_HOC_CO_DINH = """
(Thầy/cô hãy xóa dòng này và dán toàn bộ nội dung chữ từ file PDF bài giảng vào đây)
Ví dụ: Chương 1: Giới thiệu về Tin học đại cương...
"""

st.set_page_config(page_title="Gia sư Tin học AI", layout="wide")
API_KEY = os.getenv("GEMINI_API_KEY")

if API_KEY:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    st.error("Lỗi: Chưa cấu hình GEMINI_API_KEY trên Vercel!")

# Khởi tạo bảng điểm trong bộ nhớ phiên
if 'db_diem' not in st.session_state:
    st.session_state.db_diem = []

# --- GIAO DIỆN TABS ---
tab1, tab2, tab3 = st.tabs(["📤 Giảng viên", "📖 Bài giảng", "📝 Kiểm tra"])

# --- CỬA SỔ 1: GIẢNG VIÊN ---
with tab1:
    st.header("Quản trị dành cho Giảng viên")
    st.success(f"✅ App đang sử dụng dữ liệu cố định từ ID: {FIXED_FOLDER_ID}")
    st.info("Lưu ý: Nội dung bài giảng đã được tích hợp trực tiếp vào mã nguồn.")
    
    st.subheader("Kết quả học tập của Sinh viên")
    if st.session_state.db_diem:
        df = pd.DataFrame(st.session_state.db_diem)
        st.table(df)
        st.download_button("Tải bảng điểm (Excel/CSV)", df.to_csv(index=False), "bang_diem.csv")
    else:
        st.write("Chưa có sinh viên nào nộp bài.")

# --- CỬA SỔ 2: BÀI GIẢNG (Dành cho Sinh viên) ---
with tab2:
    st.header("📖 Nội dung bài học")
    if len(NOI_DUNG_BAI_HOC_CO_DINH.strip()) < 10:
        st.warning("Giảng viên chưa dán nội dung văn bản vào code.")
    else:
        if st.button("Bấm để xem bài giảng chi tiết"):
            with st.spinner("AI đang soạn bài giảng..."):
                prompt = f"Dựa trên tài liệu này: {NOI_DUNG_BAI_HOC_CO_DINH}. Hãy viết bài giảng chi tiết, có cấu trúc."
                response = model.generate_content(prompt)
                st.markdown(response.text)
        
        st.divider()
        st.subheader("Hỏi đáp về bài học")
        user_qs = st.text_input("Em có câu hỏi gì không?")
        if user_qs:
            res_qs = model.generate_content(f"Dựa trên tài liệu: {NOI_DUNG_BAI_HOC_CO_DINH}, trả lời: {user_qs}")
            st.write(f"🤖 AI trả lời: {res_qs.text}")

# --- CỬA SỔ 3: KIỂM TRA ---
with tab3:
    st.header("📝 Bài kiểm tra kiến thức")
    with st.form("form_kiem_tra"):
        ho_ten = st.text_input("Họ và Tên:")
        lop = st.text_input("Lớp:")
        st.write("Hệ thống sẽ tạo câu hỏi và chấm điểm dựa trên bài học.")
        btn_nop_bai = st.form_submit_button("Nộp bài & Xem kết quả")
        
        if btn_nop_bai and ho_ten:
            with st.spinner("Đang chấm bài..."):
                prompt_test = f"Dựa trên tài liệu: {NOI_DUNG_BAI_HOC_CO_DINH}, hãy tạo 5 câu trắc nghiệm, đưa ra đáp án và chấm điểm 10 cho SV {ho_ten}. Trả về: Điểm, Nhận xét chi tiết, Đáp án."
                res_test = model.generate_content(prompt_test)
                
                st.success(f"Kết quả của {ho_ten}:")
                st.markdown(res_test.text)
                
                # Lưu vào danh sách cho GV xem
                st.session_state.db_diem.append({
                    "STT": len(st.session_state.db_diem) + 1,
                    "Họ tên": ho_ten,
                    "Lớp": lop,
                    "Điểm": "Đã chấm",
                    "Chi tiết": "Xem tại tab Kiểm tra"
                })
