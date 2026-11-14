from app.services.data_exposure import classify_items


def test_data_exposure_classification():
    items = [
        "Aadhaar number",
        "PAN card",
        "bank account number",
        "OTP",
        "resume",
        "phone number",
        "password",
    ]
    res = classify_items(items)
    by_item = {r["item"]: r["category"] for r in res["results"]}
    assert by_item["Aadhaar number"] == "identity"
    assert by_item["PAN card"] == "identity"
    assert by_item["bank account number"] == "financial"
    assert by_item["OTP"] == "credentials"
    assert by_item["phone number"] == "contact"
    assert by_item["password"] == "credentials"
    assert by_item["resume"] == "ordinary"
    assert res["hard_warning"] is True
    assert "Never share passwords" in (res["hard_warning_message"] or "")