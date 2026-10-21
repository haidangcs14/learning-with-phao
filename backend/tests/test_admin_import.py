from app.modules.admin.importer import normalize_row, parse_rows, validate_rows


def test_csv_import_validates():
    csv = (b"question,type,level,option_a,option_b,option_c,option_d,answer\n"
           b"What is 2+2?,multiple_choice,A1,3,4,5,6,B\n"
           b"Bad row,multiple_choice,Z9,a,b,,,A\n")
    valid, errors = validate_rows(parse_rows("q.csv", "text/csv", csv))
    assert len(valid) == 1 and valid[0]["correct_answer"] == "4" and len(errors) == 1


def test_rejects_bad_extension():
    import pytest

    from app.common.exceptions import AppException
    with pytest.raises(AppException):
        parse_rows("evil.exe", None, b"x")


def test_normalize_letter_answer():
    r = normalize_row({"question": "q?", "option_a": "x", "option_b": "y", "answer": "B"})
    assert r["correct_answer"] == "y"
