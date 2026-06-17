from setuptools import setup, find_packages

setup(
    name="growpodempire",
    version="2.0.0",
    description="GROWv2 — cannabis cultivation game (economy, genetics, real-time sim, on-chain assets)",
    author="GROWv2",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.8",
    install_requires=[
        "flask>=2.3.2",
        "flask-cors>=4.0.0",
        "sqlalchemy>=2.0.23",
        "pydantic>=2.5.0",
        "python-dotenv>=1.0.0",
        "PyYAML>=6.0",
    ],
)
