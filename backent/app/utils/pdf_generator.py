import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from typing import List, Dict, Any


def generar_pdf_notas_estudiante(data: Dict[str, Any]) -> io.BytesIO:
    """
    Genera un PDF con el formato oficial de 'STUDENT REPORT CARD' de Binglish.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), leftMargin=40, rightMargin=40, topMargin=30, bottomMargin=30)
    elements = []
    styles = getSampleStyleSheet()
    
    # --- Encabezado ---
    import os
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    logo_path = os.path.join(BASE_DIR, "frontend", "assets", "logo.png")
    
    try:
        logo = Image(logo_path, width=1.5 * inch, height=1.5 * inch)
    except:
        logo = Paragraph("", styles["Normal"])

    title_text = (
        "<font color='#003366' size=18><b>BINGLISH THE RIGHT MOVE - LEARNING CENTRE</b></font><br/><br/>"
        "<font color='#003366' size=16><b>STUDENT REPORT CARD</b></font>"
    )
    header_content = Paragraph(title_text, styles["Title"])
    
    header_table = Table([[logo, header_content]], colWidths=[1.8 * inch, 7.8 * inch])
    header_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE'), ('ALIGN', (1,0), (1,0), 'CENTER')]))
    elements.append(header_table)
    elements.append(Spacer(1, 10))

    # --- Información del Estudiante (3 Columnas) ---
    # Izquierda: Name, Level, Teacher
    # Centro: Schedule, Ending Date, Rec. Level
    # Derecha: Code, Status
    
    info_data = [
        ["STUDENT NAME:", data["student_name"], "SCHEDULE:", data["schedule"], "CODE:", data["student_code"]],
        ["LEVEL:", data["level"], "ENDING DATE:", data["ending_date"], "PASSED:", "[ X ]" if data["is_passed"] else "[   ]"],
        ["TEACHER:", data["teacher_name"], "RECOMMENDED LEVEL:", data["recommended_level"], "FAILED:", "[   ]" if data["is_passed"] else "[ X ]"]
    ]
    
    # Ajustar anchos para 3 pilares proporcionales (Landscape: ~10 inches usable)
    info_table = Table(info_data, colWidths=[1.8*inch, 1.8*inch, 1.6*inch, 1.8*inch, 1.2*inch, 1.0*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        # Líneas para los valores
        ('LINEBELOW', (1, 0), (1, 2), 0.5, colors.black), # Student Name, Level, Teacher
        ('LINEBELOW', (3, 0), (3, 2), 0.5, colors.black), # Schedule, End Date, Rec Level
        ('LINEBELOW', (5, 0), (5, 0), 0.5, colors.black), # Code
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 15))

    # --- Tabla de Calificaciones ---
    m = data["midterm"]
    f = data["final"]
    
    mid_pretotal = m["reading"] + m["listening"] + m["writing"] + m["speaking"] + m["participation"] + m["attendance"]
    fin_pretotal = f["reading"] + f["listening"] + f["writing"] + f["speaking"] + f["participation"] + f["attendance"]
    overall_total = int(round((mid_pretotal + fin_pretotal) / 2))

    table_data = [
        [Paragraph("<b>SKILLS AND ASSESSMENT<br/>CRITERIA</b>", styles["Normal"]), 
         Paragraph("<b>MIDTERM<br/>ASSESSMENT SCORES</b>", styles["Normal"]), 
         Paragraph("<b>FINAL<br/>ASSESSMENT SCORES</b>", styles["Normal"]), 
         Paragraph("<b>TEACHER'S COMMENT<br/>MIDTERM</b>", styles["Normal"]), 
         Paragraph("<b>TEACHER'S COMMENT<br/>FINAL</b>", styles["Normal"])],
        
        ["READING COMPREHENSION", f"{m['reading']} /20", f"{f['reading']} /20", m["comment"], f["comment"]],
        ["LISTENING COMPREHENSION", f"{m['listening']} /20", f"{f['listening']} /20", "", ""],
        ["WRITING", f"{m['writing']} /15", f"{f['writing']} /15", "", ""],
        ["SPEAKING", f"{m['speaking']} /15", f"{f['speaking']} /15", "", ""],
        ["CLASS PARTICIPATION & ENGAGEMENT", f"{m['participation']} /15", f"{f['participation']} /15", "", ""],
        ["ATTENDANCE & RESPONSABILITY", f"{m['attendance']} /15", f"{f['attendance']} /15", "", ""],
        ["PRE TOTAL", f"{mid_pretotal} /100", f"{fin_pretotal} /100", "", ""],
        ["TOTAL", "", f"{overall_total} /100", "", ""]
    ]

    # Ajustar celdas de comentarios en horizontal (Landscape usable: ~10 inch)
    main_table = Table(table_data, colWidths=[2.6*inch, 1.2*inch, 1.2*inch, 2.5*inch, 2.5*inch], 
                      rowHeights=[35, 25, 25, 25, 25, 25, 25, 25, 25])
    
    main_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 1, colors.black),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (2, -1), 'CENTER'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('BACKGROUND', (0,0), (-1,0), colors.whitesmoke),
        # Span para los comentarios (desde la fila 1 hasta la 8)
        ('SPAN', (3, 1), (3, 8)),
        ('SPAN', (4, 1), (4, 8)),
        ('ALIGN', (3,1), (4,8), 'LEFT'),
        ('VALIGN', (3,1), (4,8), 'TOP'),
        ('LEFTPADDING', (3,1), (4,8), 5),
        ('TOPPADDING', (3,1), (4,8), 5),
    ]))
    elements.append(main_table)
    elements.append(Spacer(1, 15))

    # --- Firmas ---
    sig_data = [
        ["", "__________________________", "__________________________"],
        ["", "TEACHER'S SIGNATURE", "ACADEMIC DIRECTOR SIGNATURE"]
    ]
    sig_table = Table(sig_data, colWidths=[5.0*inch, 2.5*inch, 2.5*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
    ]))
    elements.append(sig_table)
    
    # --- Footer ---
    elements.append(Spacer(1, 15))
    footer_text = "<font size=7>Note: This document is the property of Binglish The Right Move Learning Centre and is intended solely for reporting students' academic progress.</font>"
    
    elements.append(Paragraph(footer_text, styles["Normal"]))

    def draw_watermark(canvas, doc):
        canvas.saveState()
        page_width, page_height = landscape(letter)
        w, h = 5 * inch, 5 * inch
        x = (page_width - w) / 2
        y = (page_height - h) / 2
        
        try:
            from PIL import Image as PILImage
            from reportlab.lib.utils import ImageReader
            import io as local_io
            
            img = PILImage.open(logo_path).convert("RGBA")
            alpha = img.split()[3]
            alpha = alpha.point(lambda p: int(p * 0.15))
            img.putalpha(alpha)
            
            img_byte_arr = local_io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            
            canvas.drawImage(ImageReader(img_byte_arr), x, y, width=w, height=h, mask='auto', preserveAspectRatio=True)
        except Exception:
            try:
                canvas.drawImage(logo_path, x, y, width=w, height=h, mask='auto', preserveAspectRatio=True)
            except Exception:
                pass
        canvas.restoreState()

    doc.build(elements, onFirstPage=draw_watermark, onLaterPages=draw_watermark)
    buffer.seek(0)
    return buffer
