import React from 'react';
import { findDOMNode } from 'react-dom';
import { Button } from 'react-bootstrap';
import Icon from 'react-fontawesome';
import { arrayOf, oneOfType, string, object, number, func } from 'prop-types';
import { LazyLog, LazyStream, ScrollFollow } from 'react-lazylog';
import { isNil } from 'ramda';
import fscreen from 'fscreen';

const VIEWER_HEIGHT_MIN = 400;

const buttonStyle = {
  margin: '10px 0 10px 10px'
};

export default class LogView extends React.PureComponent {
  static propTypes = {
    queue: object,
    taskId: string,
    runId: number,
    status: object,
    log: object,
    highlight: oneOfType([arrayOf(number), number]),
    onHighlight: func
  };

  constructor(props) {
    super(props);

    const streaming = this.isStreaming(props.status);

    this.state = {
      streaming,
      follow: streaming,
      isFullscreen: false,
      fullscreenEnabled: fscreen.fullscreenEnabled,
      lazyViewerHeight: VIEWER_HEIGHT_MIN
    };
  }

  componentWillMount() {
    fscreen.addEventListener(
      'fullscreenchange',
      this.handleFullscreenChange,
      false
    );
    window.addEventListener('resize', this.handleLazyViewerHeight);
  }

  componentDidMount() {
    this.handleLazyViewerHeight();
  }

  componentWillUnmount() {
    fscreen.removeEventListener(
      'fullscreenchange',
      this.handleFullscreenChange
    );
    window.removeEventListener('resize', this.handleLazyViewerHeight);
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.taskId !== this.props.taskId ||
      nextProps.runId !== this.props.runId ||
      nextProps.status !== this.props.status ||
      (nextProps.log &&
        this.props.log &&
        nextProps.log.name !== this.props.log.name)
    ) {
      const streaming = this.isStreaming(nextProps.status);

      this.setState({
        streaming,
        follow: streaming,
        isFullscreen: false
      });
    }
  }

  componentDidUpdate() {
    this.handleLazyViewerHeight();
  }

  isStreaming(status) {
    return status
      ? status.state === 'pending' || status.state === 'running'
      : false;
  }

  handleFollowClick = () => this.setState({ follow: !this.state.follow });

  handleScroll = ({ scrollTop, scrollHeight, clientHeight }) => {
    if (this.state.follow && scrollHeight - scrollTop !== clientHeight) {
      this.setState({ follow: false });
    }
  };

  handleFullscreen = () =>
    this.lazylog && fscreen.requestFullscreen(this.lazylog);

  handleFullscreenChange = () => {
    this.setState({
      isFullscreen: fscreen.fullscreenElement !== null
    });
  };

  handleLazyViewerHeight = () => {
    if (this.lazylog) {
      const lazyViewerHeight =
        window.innerHeight -
        Math.round(this.lazylog.getBoundingClientRect().top);

      if (lazyViewerHeight > VIEWER_HEIGHT_MIN) {
        this.setState({ lazyViewerHeight });
      }
    }
  };

  registerChild = ref => {
    if (!ref) {
      return;
    }

    const node = findDOMNode(ref); // eslint-disable-line react/no-find-dom-node

    if (!node) {
      return;
    }

    [this.lazylog] = node.children;
  };

  render() {
    const {
      queue,
      taskId,
      runId,
      status,
      log,
      highlight,
      onHighlight
    } = this.props;
    const {
      streaming,
      follow,
      fullscreenEnabled,
      isFullscreen,
      lazyViewerHeight
    } = this.state;

    if (!queue || !taskId || isNil(runId) || !status || !log) {
      return null;
    }

    const scrollToLine = Array.isArray(highlight) ? highlight[0] : highlight;
    const url = queue.buildUrl(queue.getArtifact, taskId, runId, log.name);
    const LazyViewer = streaming ? LazyStream : LazyLog;

    return (
      <div>
        <div>
          <Button
            onClick={this.handleFollowClick}
            bsSize="sm"
            style={buttonStyle}>
            <Icon name={follow ? 'check-square-o' : 'square-o'} />
            &nbsp;&nbsp;Follow log
          </Button>

          <Button
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            bsSize="sm"
            style={buttonStyle}>
            <Icon name="external-link-square" />&nbsp;&nbsp;View raw log
          </Button>

          {fullscreenEnabled && (
            <Button
              onClick={this.handleFullscreen}
              bsSize="sm"
              style={buttonStyle}>
              <Icon name="arrows-alt" />&nbsp;&nbsp;View fullscreen
            </Button>
          )}
        </div>

        <ScrollFollow startFollowing={follow}>
          {({ follow }) => (
            <LazyViewer
              ref={this.registerChild}
              url={url}
              height={
                isFullscreen
                  ? document.documentElement.clientHeight
                  : lazyViewerHeight
              }
              follow={follow}
              scrollToLine={!follow && highlight ? scrollToLine : null}
              scrollToAlignment="start"
              highlight={highlight}
              onHighlight={onHighlight}
              onScroll={this.handleScroll}
            />
          )}
        </ScrollFollow>
      </div>
    );
  }
}
