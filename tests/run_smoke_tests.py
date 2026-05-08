import json
import sys
import os
# ensure repo root is on sys.path so `import app` works when running from tests/
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)
import app


def expect(ok, msg):
    if not ok:
        print('FAILED:', msg)
        sys.exit(2)


def main():
    c = app.app.test_client()

    # Home
    r = c.get('/')
    print('GET / ->', r.status_code)
    expect(r.status_code == 200, 'GET / failed')

    # Learn page
    r = c.get('/learn/1')
    print('GET /learn/1 ->', r.status_code)
    expect(r.status_code == 200, 'GET /learn/1 failed')

    # Quiz pages GET
    for qid in range(1, 8):
        r = c.get(f'/quiz/{qid}')
        print(f'GET /quiz/{qid} ->', r.status_code)
        expect(r.status_code == 200, f'GET /quiz/{qid} failed')

    # Submit simple quizzes
    # Quiz 1 single - wrong then correct
    r = c.post('/quiz/1', json={'choice': '2'})
    print('POST /quiz/1 (wrong) ->', r.status_code, r.get_json())
    expect(r.status_code == 200 and r.get_json().get('ok'), 'POST /quiz/1 wrong failed')
    r = c.post('/quiz/1', json={'choice': '0'})
    print('POST /quiz/1 (right) ->', r.status_code, r.get_json())

    # Quiz 2 multi_tf - send expected answers
    payload = {'tf_0': 'false', 'tf_1': 'true', 'tf_2': 'true', 'tf_3': 'false'}
    r = c.post('/quiz/2', json=payload)
    print('POST /quiz/2 ->', r.status_code, r.get_json())

    # Quiz 3 scenario_single (submit choices)
    payload = {'scenario_0': '1', 'scenario_1': '1', 'scenario_2': '2'}
    r = c.post('/quiz/3', json=payload)
    print('POST /quiz/3 ->', r.status_code, r.get_json())

    # Quiz 5 slider
    r = c.post('/quiz/5', json={'slider': '28'})
    print('POST /quiz/5 ->', r.status_code, r.get_json())

    # Quiz 6 slider
    r = c.post('/quiz/6', json={'slider': '108'})
    print('POST /quiz/6 ->', r.status_code, r.get_json())

    # Quiz 7 interactive
    payload = {'crossfader': '50', 'filter_a': '25', 'filter_b': '0', 'echo': 'false', 'gain_a': '50', 'gain_b': '52'}
    r = c.post('/quiz/7', json=payload)
    print('POST /quiz/7 ->', r.status_code, r.get_json())

    # API state
    r = c.get('/api/state')
    print('GET /api/state ->', r.status_code)
    js = r.get_json()
    print('State score/total:', js.get('score'), '/', js.get('total'))

    print('All smoke tests passed')


if __name__ == '__main__':
    main()
