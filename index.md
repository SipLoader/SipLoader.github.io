# SipLoader

With conventional web page load metrics (e.g., Page Load Time) being blamed for deviating from actual user
experiences, in recent years a more sensible and complex metric called Speed Index (SI) has been widely
adopted to measure the user’s quality of experience (QoE). In brief, SI indicates how quickly a page is filled up
with above-the-fold visible elements (or crucial elements for short). Till now, however, SI has been used as
an elusive hindsight for performance evaluation, rather than an explicit heuristic to direct page loading. To
demystify this, we examine the entire load process of various pages and ascribe such incapability to three-fold
fundamental uncertainties in terms of network, browser execution, and viewport size. In this paper, we design
SipLoader, an SI-oriented page loader through a novel cumulative reactive scheduling framework. It does not
attempt to deal with uncertainties in advance or in one shot, but “repairs” the anticipated (nearly) SI-optimal
scheduling when uncertainties actually occur, based on efficient design that fully exploits the cumulative
nature of SI calculation. Evaluations show that SipLoader improves the median SI by 41%, and provides
1.43×–1.99× more benefits than state-of-the-art solutions with little computation and traffic overhead.

### Implementation & Data

SipLoader is an SI-oriented page loader.
It implements the cumulative predictive-reactive scheduling framework through three key techniques, i.e.,
Dependency Mmerged Greedy Inference, Predictive Element Region Forest, and Event-Driven Reactive Co-Scheduling.

We provide the prototype system on [GitHub](https://github.com/SipLoader/SipLoader.github.io) as well as the measurement data on [Google Drive](https://drive.google.com/drive/folders/1ZtvnsEo7fvksBm6T--Dw7YSj9X007ll6?usp=sharing).
