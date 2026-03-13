import streamlit as st
import google.generativeai as genai
import pandas as pd
import os

# --- CẤU HÌNH HỆ THỐNG ---
st.set_page_config(page_title="Gia sư Tin học AI", layout="wide")
API_KEY = os.getenv("GEMINI_API_KEY")
FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID")

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

# Giả lập cơ sở dữ liệu điểm (Trong thực tế nên dùng Google Sheets)
if 'db_diem' not in st.session_state:
    st.session_state.db_diem = []

# --- GIAO DIỆN 3 CỬA SỔ (TABS) ---
tab1, tab2, tab3 = st.tabs(["📤 Giảng viên", "📖 Bài giảng", "📝 Kiểm tra"])

# --- CỬA SỔ 1: GIẢNG VIÊN ---
with tab1:
    st.header("Quản trị dành cho Giảng viên")
    st.info(f"📁 Thư mục tài liệu hiện tại: {FOLDER_ID}")
    st.write("Vui lòng tải tài liệu lên Google Drive. AI sẽ tự động cập nhật.")
    
    if st.button("Xuất bảng điểm (Excel)"):
        if st.session_state.db_diem:
            df = pd.DataFrame(st.session_state.db_diem)
            st.table(df)
            st.download_button("Tải file CSV", df.to_csv(index=False), "bang_diem.csv")
        else:
            st.warning("Chưa có sinh viên nào làm bài.")

# --- CỬA SỔ 2: BÀI GIẢNG & HỎI ĐÁP ---
with tab2:
    st.header("Nội dung bài học")
    # Prompt yêu cầu AI tóm tắt bài giảng từ Drive (giả định thông tin đã truyền qua API)
    context = f"Dựa trên tài liệu trong folder {FOLDER_ID}, hãy tạo bài giảng chi tiết..."
    
    if st.button("Xem bài giảng"):
        with st.spinner("Đang soạn bài giảng..."):
            response = model.generate_content(context)
            st.markdown(response.text)
    
    st.divider()
    user_qs = st.text_input("Sinh viên đặt câu hỏi tại đây:")
    if user_qs:
        res_qs = model.generate_content(f"Dựa trên tài liệu, trả lời: {user_qs}")
        st.write(f"🤖 AI trả lời: {res_qs.text}")

# --- CỬA SỔ 3: BÀI KIỂM TRA ---
with tab3:
    st.header("Làm bài kiểm tra")
    with st.form("quiz_form"):
        ho_ten = st.text_input("Họ và Tên:")
        lop = st.text_input("Lớp:")
        st.write("--- Câu hỏi sẽ hiển thị bên dưới ---")
        # Logic tạo câu hỏi từ AI
        submit = st.form_submit_button("Nộp bài")
        
        if submit and ho_ten and lop:
            # Giả lập chấm điểm ngẫu nhiên để minh họa (Trong code thật AI sẽ chấm)
            diem = 8.5 
            nhan_xet = f"Chào {ho_ten}, em nắm vững kiến thức cơ bản nhưng cần thực hành thêm."
            
            st.success(f"Kết quả của {ho_ten}: {diem}/10")
            st.info(f"Nhận xét: {nhan_xet}")
            
            # Lưu vào danh sách cho GV
            st.session_state.db_diem.append({
                "STT": len(st.session_state.db_diem) + 1,
                "Họ tên": ho_ten,
                "Lớp": lop,
                "Điểm": diem,
                "Nhận xét": nhan_xet
            })
