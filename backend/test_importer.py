import traceback

try:
    import app.main
    print('OK')
except Exception as e:
    print(repr(traceback.format_exc()))
