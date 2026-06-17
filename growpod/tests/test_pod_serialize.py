"""pod_dict serialization exposes the pod's environment setpoints.

The web client's grow-chamber climate controls seed their slider start values
from these fields, so they must round-trip through the wire format.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.api.serialize import pod_dict
from growpodempire.db.session import session_scope
from growpodempire.services.game_service import GameService

ENV_FIELDS = ("temperature", "humidity", "co2_level", "light_intensity", "ph_level")


def test_pod_dict_includes_environment_fields(db):
    with session_scope() as s:
        svc = GameService(s)
        player = svc.create_player("env_serialize")
        pod = svc.create_pod(player.id, "Tent", charge=False)

        # A fresh pod has no environment set yet -> fields present but null.
        fresh = pod_dict(pod)
        for field in ENV_FIELDS:
            assert field in fresh, f"{field} missing from pod_dict"
            assert fresh[field] is None

        # After setting setpoints, pod_dict reflects them exactly.
        pod.temperature = 24.0
        pod.humidity = 55.0
        pod.co2_level = 900.0
        pod.light_intensity = 600.0
        pod.ph_level = 6.3
        s.flush()

        out = pod_dict(pod)
        assert out["temperature"] == 24.0
        assert out["humidity"] == 55.0
        assert out["co2_level"] == 900.0
        assert out["light_intensity"] == 600.0
        assert out["ph_level"] == 6.3
