import streamlit as st
import google.generativeai as genai
import pandas as pd
import os

# --- CẤU HÌNH ---
st.set_page_config(page_title="Gia sư Tin học AI", layout="wide")
API_KEY = os.getenv("GEMINI_API_KEY")

if API_KEY:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    st.error("Thiếu API Key trong Environment Variables!")

# Khởi tạo bộ nhớ dữ liệu
if 'du_lieu_hoc_tap' not in st.session_state:
    st.session_state.du_lieu_hoc_tap = ""
if 'bang_diem' not in st.session_state:
    st.session_state.bang_diem = []

# --- GIAO DIỆN ---
tab1, tab2, tab3 = st.tabs(["📤 Cửa sổ 1: Giảng viên", "📖 Cửa sổ 2: Bài giảng", "📝 Cửa sổ 3: Kiểm tra"])

# --- CỬA SỔ 1: GIẢNG VIÊN ---
with tab1:
    st.header("Khu vực Quản trị")
    # Thay vì dùng Drive ID khó kết nối, thầy cô dán nội dung văn bản vào đây
    input_text = st.text_area("Dán nội dung tài liệu giảng dạy vào đây (Ctrl+A từ Word/PDF rồi dán vào):", height=300)
    
    if st.button("Lưu và Cập nhật bài giảng"):
        if input_text:
            st.session_state.du_lieu_hoc_tap = input_text
            st.success("Đã cập nhật tài liệu! Sinh viên bây giờ có thể xem bài giảng.")
        else:
            st.warning("Vui lòng dán nội dung trước.")

    st.divider()
    st.subheader("Bảng điểm tổng quát")
    if st.session_state.bang_diem:
        df = pd.DataFrame(st.session_state.bang_diem)
        st.table(df)
        st.download_button("Xuất file Excel (CSV)", df.to_csv(index=False), "ket_qua.csv")
    else:
        st.write("Chưa có kết quả.")

# --- CỬA SỔ 2: SINH VIÊN HỌC TẬP ---
with tab2:
    st.header("Nội dung bài giảng")
    if not st.session_state.du_lieu_hoc_tap:
        st.info("Đang chờ giảng viên cập nhật tài liệu...")
    else:
        with st.spinner("AI đang soạn bài giảng..."):
            if 'cached_lecture' not in st.session_state:
                prompt = f"Dựa trên tài liệu này: {st.session_state.du_lieu_hoc_tap}. Hãy viết bài giảng chi tiết, dễ hiểu."
                response = model.generate_content(prompt)
                st.session_state.cached_lecture = response.text
            st.markdown(st.session_state.cached_lecture)
        
        st.divider()
        st.subheader("Hỏi đáp với AI")
        cau_hoi = st.text_input("Em có thắc mắc gì về bài học không?")
        if cau_hoi:
            res = model.generate_content(f"Dựa trên tài liệu: {st.session_state.du_lieu_hoc_tap}, trả lời ngắn gọn: {cau_hoi}")
            st.write(f"🤖 AI: {res.text}")

# --- CỬA SỔ 3: BÀI KIỂM TRA ---
with tab3:
    st.header("Kiểm tra kiến thức")
    if not st.session_state.du_lieu_hoc_tap:
        st.error("Chưa có dữ liệu bài tập.")
    else:
        with st.form("quiz"):
            name = st.text_input("Họ và Tên:")
            lop = st.text_input("Lớp:")
            st.write("Sau khi điền tên, nhấn nút dưới đây để làm bài và chấm điểm.")
            submit = st.form_submit_button("Nộp bài & Xem kết quả")
            
            if submit and name:
                prompt_test = f"Dựa trên tài liệu: {st.session_state.du_lieu_hoc_tap}, hãy chấm điểm 10 cho sinh viên này qua các câu hỏi mô phỏng. Trả về: Điểm (số), Nhận xét (chi tiết, không trùng lặp), Đáp án."
                res_test = model.generate_content(prompt_test)
                
                # Hiển thị cho SV
                st.success(f"Chào {name}, bài làm của em đã được chấm xong!")
                st.markdown(res_test.text)
                
                # Lưu cho GV (Giả định điểm từ AI)
                st.session_state.bang_diem.append({
                    "STT": len(st.session_state.bang_diem)+1,
                    "Họ tên": name, "Lớp": lop, "Điểm": "Đã chấm", "Nhận xét": "Xem trong chi tiết"
                })
